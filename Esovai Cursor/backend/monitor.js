/**
 * ESO Bot — SOC Monitor
 * Checkt alle 10 Minuten die Health der Docker-Services.
 * Schreibt Alerts/Zusammenfassungen ins Postfach.
 */

import fs from "fs/promises";
import { execSync } from "child_process";

const STATE_FILE = "/data/monitor-state.json";
const CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 Minuten

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

  return {
    timestamp: new Date().toISOString(),
    services: results,
    disk,
    memory: mem,
    allOk: results.every(r => r.up) && disk.ok && mem.ok,
  };
}
