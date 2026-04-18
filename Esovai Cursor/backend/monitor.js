/**
 * ESO Bot — SOC Monitor
 * Checkt alle 10 Minuten die Health der Docker-Services + Wazuh-Alerts.
 * Schreibt Alerts/Zusammenfassungen ins Postfach.
 */

import fs from "fs/promises";
import https from "node:https";
import { execSync } from "child_process";

const STATE_FILE = "/data/monitor-state.json";
const CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 Minuten

// ── Wazuh Konfiguration (optional, via .env) ──────────────────
// Wazuh läuft in einem separaten Stack; Zugang über host.docker.internal
// (extra_hosts: host-gateway in docker-compose.yml des Backend-Services)
const WAZUH_INDEXER  = (process.env.WAZUH_INDEXER_URL  || "").trim();  // z.B. https://host.docker.internal:9201
const WAZUH_MANAGER  = (process.env.WAZUH_MANAGER_URL  || "").trim();  // z.B. https://host.docker.internal:55000
const WAZUH_USER     = (process.env.WAZUH_ADMIN_USER   || "admin").trim();
const WAZUH_PASS     = (process.env.WAZUH_ADMIN_PASS   || "").trim();
const WAZUH_ENABLED  = !!(WAZUH_INDEXER || WAZUH_MANAGER);
// Mindest-Level für Alert-Postfach: 12 = critical, 10 = high
const WAZUH_ALERT_LEVEL = parseInt(process.env.WAZUH_ALERT_LEVEL || "12", 10);

// Services die gecheckt werden
const SERVICES = [
  { name: "Ollama",   url: "http://ollama:11434",           path: "/" },
  { name: "SearXNG",  url: "http://searxng:8080",           path: "/" },
];

// ── State (Uptime-Tracking) ───────────────────────────────────
let state = {};   // { [name]: { up: bool, failsSince: Date|null, lastAlert: Date|null } }
let addPostfachFn = null; // wird von startMonitor gesetzt

async function loadState() {
  try {
    state = JSON.parse(await fs.readFile(STATE_FILE, "utf8"));
  } catch {
    state = {};
  }
}

async function saveState() {
  try { await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2)); } catch {}
}

// ── HTTP Health Check ─────────────────────────────────────────
async function checkHttp(service) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(service.url + service.path, {
      signal: controller.signal,
      headers: { "User-Agent": "ESO-Monitor/1.0" },
    });
    clearTimeout(timeout);
    return { up: res.status < 500, status: res.status };
  } catch (err) {
    clearTimeout(timeout);
    return { up: false, status: null, error: err.message };
  }
}

// ── Disk Usage Check ──────────────────────────────────────────
function checkDisk() {
  try {
    // BusyBox/Alpine: `df` hat kein `--output=...`. Daher Standard-Output parsen:
    // Filesystem Size Used Avail Use% Mounted on
    // overlay     10G  2G   8G   20%  /data
    const out = execSync("df -h /data 2>/dev/null | tail -1", {
      timeout: 3000,
      encoding: "utf8",
    }).trim();
    const parts = out.split(/\s+/);
    const pct = parts[4];
    const avail = parts[3];
    const usedPct = Number.parseInt(String(pct || "").replace("%", ""), 10);
    if (!Number.isFinite(usedPct)) return { ok: true, usedPct: null, avail: null };
    return { ok: usedPct < 85, usedPct, avail: avail || null };
  } catch {
    return { ok: true, usedPct: null, avail: null };
  }
}

// ── Memory Check ──────────────────────────────────────────────
function checkMemory() {
  try {
    const mem = execSync("free -m 2>/dev/null | awk '/Mem:/{print $2,$3}'", {
      timeout: 3000,
      encoding: "utf8",
    }).trim();
    const [total, used] = mem.split(" ").map(Number);
    const usedPct = Math.round((used / total) * 100);
    return { ok: usedPct < 90, usedPct, usedMB: used, totalMB: total };
  } catch {
    return { ok: true, usedPct: null };
  }
}

// ── Wazuh HTTPS-Helper ────────────────────────────────────────
// Wazuh nutzt selbst-signierte Zertifikate → rejectUnauthorized:false
function wazuhHttps(method, urlStr, headers, body) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(urlStr); } catch { return reject(new Error(`Ungültige URL: ${urlStr}`)); }
    const options = {
      hostname: u.hostname,
      port: parseInt(u.port) || 443,
      path: u.pathname + u.search,
      method,
      headers: { "Content-Type": "application/json", ...headers },
      rejectUnauthorized: false, // self-signed cert
      timeout: 8000,
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch  { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Wazuh HTTPS-Timeout")); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ── Wazuh Manager: JWT Token ──────────────────────────────────
let _wazuhToken = null;
let _wazuhTokenExp = 0;

async function getWazuhToken() {
  if (!WAZUH_MANAGER) return null;
  if (_wazuhToken && Date.now() < _wazuhTokenExp) return _wazuhToken;
  const auth = Buffer.from(`${WAZUH_USER}:${WAZUH_PASS}`).toString("base64");
  try {
    const res = await wazuhHttps("POST", `${WAZUH_MANAGER}/security/user/authenticate`,
      { Authorization: `Basic ${auth}` }, {});
    const token = res.data?.data?.token;
    if (!token) { console.warn("[Monitor] Wazuh Auth: kein Token"); return null; }
    _wazuhToken = token;
    _wazuhTokenExp = Date.now() + 14 * 60 * 1000; // 15-Min JWT, erneuern nach 14
    return token;
  } catch (e) {
    console.warn(`[Monitor] Wazuh Auth Fehler: ${e.message}`);
    return null;
  }
}

// ── Wazuh Manager: Agent-Übersicht ───────────────────────────
async function getWazuhAgentSummary() {
  if (!WAZUH_MANAGER) return null;
  const token = await getWazuhToken();
  if (!token) return null;
  try {
    const res = await wazuhHttps("GET", `${WAZUH_MANAGER}/agents/summary/status`,
      { Authorization: `Bearer ${token}` }, null);
    if (res.status === 401) { _wazuhToken = null; return null; }
    return res.data?.data?.connection || null;
  } catch (e) {
    console.warn(`[Monitor] Wazuh Agent-Summary Fehler: ${e.message}`);
    return null;
  }
}

// ── Wazuh Indexer: Kritische Alerts ──────────────────────────
async function fetchWazuhAlerts(sinceMinutes = 10, minLevel = 10) {
  if (!WAZUH_INDEXER) return null;
  const auth = Buffer.from(`${WAZUH_USER}:${WAZUH_PASS}`).toString("base64");
  const body = {
    size: 10,
    sort: [{ timestamp: { order: "desc" } }],
    query: {
      bool: {
        filter: [
          { range: { "rule.level": { gte: minLevel } } },
          { range: { timestamp: { gte: `now-${sinceMinutes}m` } } },
        ],
      },
    },
    _source: ["timestamp", "rule.level", "rule.description", "rule.id",
              "agent.name", "agent.ip", "data.srcip", "full_log"],
  };
  try {
    const res = await wazuhHttps("POST",
      `${WAZUH_INDEXER}/wazuh-alerts-*/_search`,
      { Authorization: `Basic ${auth}` }, body);
    if (res.status !== 200) {
      console.warn(`[Monitor] Wazuh Indexer HTTP ${res.status}`);
      return null;
    }
    return (res.data?.hits?.hits || []).map(h => h._source);
  } catch (e) {
    console.warn(`[Monitor] Wazuh Indexer Fehler: ${e.message}`);
    return null;
  }
}

// ── Wazuh Check (Alerts + Agent-Status) ──────────────────────
async function checkWazuh() {
  if (!WAZUH_ENABLED) return null;

  const intervalMin = Math.round(CHECK_INTERVAL_MS / 60000);
  const wazuhAlerts = await fetchWazuhAlerts(intervalMin, 10);
  const agentSummary = await getWazuhAgentSummary();

  // Kein Indexer konfiguriert → nur Manager-Status
  if (wazuhAlerts === null && !agentSummary) {
    return { ok: false, error: "Wazuh nicht erreichbar", alerts: [], agents: null };
  }

  const alerts = wazuhAlerts || [];
  const critical = alerts.filter(a => (a.rule?.level || 0) >= WAZUH_ALERT_LEVEL);
  const high     = alerts.filter(a => (a.rule?.level || 0) >= 10 && (a.rule?.level || 0) < WAZUH_ALERT_LEVEL);

  // Alert-Texte (max 5)
  const lines = alerts.slice(0, 5).map(a => {
    const ts    = (a.timestamp || "").replace("T", " ").slice(0, 16);
    const agent = a.agent?.name || a.agent?.ip || "?";
    const desc  = a.rule?.description || "Unbekannte Regel";
    const lvl   = a.rule?.level ?? "?";
    return `• [L${lvl}] ${desc} | Agent: ${agent} | ${ts}`;
  });

  return {
    ok:       critical.length === 0,
    critical: critical.length,
    high:     high.length,
    total:    alerts.length,
    lines,
    agents:   agentSummary,
  };
}

// ── Postfach schreiben ────────────────────────────────────────
async function postToInbox(title, content, type = "info") {
  if (addPostfachFn) {
    await addPostfachFn(title, content, type);
  }
}

// ── Haupt-Check ───────────────────────────────────────────────
async function runChecks() {
  const now = new Date();
  const results = [];
  const alerts = [];

  // HTTP Checks
  for (const svc of SERVICES) {
    const result = await checkHttp(svc);
    const prev = state[svc.name] || { up: true, failsSince: null };

    if (!result.up && prev.up) {
      // War up → jetzt down
      state[svc.name] = { up: false, failsSince: now.toISOString(), lastAlert: now.toISOString() };
      alerts.push({ type: "alert", title: `🔴 ${svc.name} ist down`, msg: `Status: ${result.status || "keine Antwort"} — ${result.error || ""}` });
    } else if (result.up && !prev.up) {
      // War down → jetzt wieder up
      const since = prev.failsSince ? new Date(prev.failsSince) : null;
      const downMin = since ? Math.round((now - since) / 60000) : "?";
      state[svc.name] = { up: true, failsSince: null, lastAlert: null };
      alerts.push({ type: "info", title: `🟢 ${svc.name} ist wieder online`, msg: `War ${downMin} Minuten nicht erreichbar.` });
    } else {
      state[svc.name] = { ...prev, up: result.up };
    }

    results.push(`${result.up ? "🟢" : "🔴"} ${svc.name}: ${result.up ? `HTTP ${result.status}` : (result.error || "timeout")}`);
  }

  // Disk Check
  const disk = checkDisk();
  if (!disk.ok && disk.usedPct !== null) {
    alerts.push({
      type: "warning",
      title: `⚠️ Disk Usage: ${disk.usedPct}%`,
      msg: disk.avail ? `Noch ${disk.avail} frei auf /data. Bitte aufräumen!` : "Bitte /data aufräumen!",
    });
  }
  results.push(disk.usedPct !== null ? `💾 Disk: ${disk.usedPct}% belegt (${disk.avail} frei)` : "💾 Disk: n/a");

  // Memory Check
  const mem = checkMemory();
  if (!mem.ok) {
    alerts.push({ type: "warning", title: `⚠️ RAM Usage: ${mem.usedPct}%`, msg: `${mem.usedMB} MB / ${mem.totalMB} MB belegt.` });
  }
  results.push(mem.usedPct !== null ? `🧠 RAM: ${mem.usedPct}% (${mem.usedMB}/${mem.totalMB} MB)` : "🧠 RAM: n/a");

  // Wazuh Check
  if (WAZUH_ENABLED) {
    const wazuh = await checkWazuh();
    if (!wazuh) {
      results.push("🔒 Wazuh: deaktiviert");
    } else if (wazuh.error) {
      results.push(`🔒 Wazuh: ${wazuh.error}`);
    } else {
      // Agent-Status
      if (wazuh.agents) {
        const { active = 0, disconnected = 0, never_connected = 0 } = wazuh.agents;
        results.push(`🔒 Wazuh Agents: active=${active}, offline=${disconnected}, nie=${never_connected}`);
        if (disconnected > 0) {
          alerts.push({ type: "warning", title: `⚠️ Wazuh: ${disconnected} Agent(s) offline`, msg: `${disconnected} Wazuh-Agent(s) nicht verbunden. Bitte prüfen.` });
        }
      }
      // Alert-Summary
      if (wazuh.total === 0) {
        results.push(`🔒 Wazuh Alerts: keine (Level≥10) in letzten ${Math.round(CHECK_INTERVAL_MS / 60000)} Min.`);
      } else {
        const alertSummary = wazuh.lines.join("\n");
        results.push(`🔒 Wazuh Alerts: ${wazuh.total} (${wazuh.critical} critical, ${wazuh.high} high)`);
        if (wazuh.critical > 0) {
          alerts.push({
            type: "alert",
            title: `🚨 Wazuh: ${wazuh.critical} kritische${wazuh.critical !== 1 ? "r" : ""} Alert(s)`,
            msg: alertSummary,
          });
        } else if (wazuh.high > 0) {
          // Nur einmal pro Stunde High-Alerts melden
          const lastHighAlert = state._lastWazuhHighAlert ? new Date(state._lastWazuhHighAlert) : null;
          if (!lastHighAlert || now - lastHighAlert > 60 * 60 * 1000) {
            alerts.push({
              type: "warning",
              title: `⚠️ Wazuh: ${wazuh.high} High-Alert(s)`,
              msg: alertSummary,
            });
            state._lastWazuhHighAlert = now.toISOString();
          }
        }
      }
    }
  }

  // Alerts direkt posten
  for (const alert of alerts) {
    await postToInbox(alert.title, alert.msg, alert.type);
  }

  // Täglicher Summary um 08:00
  const hour = now.getHours();
  const lastSummary = state._lastSummary ? new Date(state._lastSummary) : null;
  const summaryDue = hour === 8 && (!lastSummary || now - lastSummary > 23 * 60 * 60 * 1000);

  if (summaryDue) {
    const allOk = SERVICES.every(s => state[s.name]?.up !== false);
    const title = allOk ? "✅ Täglicher Status-Check — alles grün" : "⚠️ Täglicher Status-Check — Probleme erkannt";
    const content = results.join("\n");
    await postToInbox(title, content, allOk ? "info" : "warning");
    state._lastSummary = now.toISOString();
  }

  await saveState();
  console.log(`[Monitor] Check ${now.toISOString()} — ${alerts.length} Alert(s)`);
}

// ── Public API ────────────────────────────────────────────────
export async function startMonitor(postfachFn) {
  addPostfachFn = postfachFn;
  await loadState();

  // Sofort einmal laufen, dann alle 10 Minuten
  runChecks().catch(err => console.error("[Monitor] Fehler:", err));
  setInterval(() => {
    runChecks().catch(err => console.error("[Monitor] Fehler:", err));
  }, CHECK_INTERVAL_MS);

  console.log("[Monitor] SOC Monitor gestartet — Intervall: 10 Minuten");
}

// ── Manueller Check (für API-Endpoint) ────────────────────────
export async function getMonitorStatus() {
  const results = [];

  for (const svc of SERVICES) {
    const result = await checkHttp(svc);
    results.push({ name: svc.name, up: result.up, status: result.status, error: result.error || null });
  }

  const disk = checkDisk();
  const mem = checkMemory();
  const wazuh = WAZUH_ENABLED ? await checkWazuh() : null;

  return {
    timestamp: new Date().toISOString(),
    services: results,
    disk,
    memory: mem,
    wazuh,
    allOk: results.every(r => r.up) && disk.ok && mem.ok && (!wazuh || wazuh.ok !== false || !!wazuh.error),
  };
}
