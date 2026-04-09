/**
 * ESO Bot — Flexibler Task-Scheduler (OpenClaw-Pattern)
 *
 * Schedule-Arten:
 *   { kind: "at",    at: "<ISO-String>" }            — einmalig zu fixer Zeit
 *   { kind: "every", everyMs: 3600000, anchorMs? }   — fixes Intervall
 *   { kind: "cron",  expr: "0 9 * * 1-5", tz? }     — Cron-Expression (via croner)
 *
 * Payload-Arten:
 *   { kind: "agentTurn",   message: "..." }  — Web-Suche + LLM → Inbox + Postfach
 *   { kind: "systemEvent", text: "..." }     — direkt ins Postfach, kein LLM
 *
 * Tasks werden in /data/scheduled-tasks.json gespeichert.
 * Run-Logs pro Task in /data/cron-runs/<taskId>.jsonl (max 2 MB).
 *
 * Backward-Compat: Alte Tasks mit { executeAt, repeat, instruction }
 * werden beim Laden automatisch ins neue Format migriert.
 */

import fs from "fs/promises";
import path from "path";
import { Cron } from "croner";
import { parseAbsoluteTimeMs } from "./cron-parse.js";

const TASKS_FILE     = "/data/scheduled-tasks.json";
const RUN_LOG_DIR    = "/data/cron-runs";
const TICK_MS        = 60_000;   // jede Minute prüfen

// Exponential-Backoff-Tabelle (in ms), port von OpenClaw service/timer.ts
const BACKOFF_TABLE  = [30_000, 60_000, 300_000, 900_000, 3_600_000];
const MAX_RETRIES    = 3;

// Failure-Alert: nach wie vielen aufeinanderfolgenden Fehlern → Inbox-Notification
const ALERT_AFTER    = 2;
// Cooldown zwischen zwei Alerts pro Task (1 Stunde)
const ALERT_COOLDOWN = 3_600_000;

// Concurrency: wie viele Tasks gleichzeitig laufen dürfen (port von OpenClaw maxConcurrentRuns)
const MAX_CONCURRENT = 3;

// Stagger: Top-of-Hour-Cron-Expressions bekommen 5 Min Versatz (port von OpenClaw stagger.ts)
const TOP_OF_HOUR_STAGGER_MS = 300_000; // 5 Minuten

// Run-Log: max Dateigröße bevor Prune
const RUN_LOG_MAX_BYTES  = 2 * 1024 * 1024; // 2 MB
const RUN_LOG_KEEP_LINES = 2000;

// Dependency-Injections (werden via startScheduler() gesetzt)
let webSearchFn   = null;
let addPostfachFn = null;
let addInboxFn    = null;
let sendEmailFn   = null;
let llmClientFn   = null;

// ── Atomarer Store (port von OpenClaw store.ts) ───────────────

async function atomicWriteJson(filePath, data) {
  const dir  = path.dirname(filePath);
  const tmp  = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  const bak  = `${filePath}.bak`;

  await fs.mkdir(dir, { recursive: true });

  // Backup der aktuellen Datei (nur wenn sie existiert)
  try {
    await fs.copyFile(filePath, bak);
  } catch (e) {
    if (e.code !== "ENOENT") console.warn("[Store] Backup fehlgeschlagen:", e.message);
  }

  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  try {
    await fs.rename(tmp, filePath);
  } catch (e) {
    // Windows: EPERM/EEXIST bei rename → copyFile + unlink als Fallback
    if (e.code === "EPERM" || e.code === "EEXIST") {
      await fs.copyFile(tmp, filePath);
      await fs.unlink(tmp).catch(() => {});
    } else {
      await fs.unlink(tmp).catch(() => {});
      throw e;
    }
  }
}

async function loadTasksRaw() {
  try {
    const raw = await fs.readFile(TASKS_FILE, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === "ENOENT") return [];
    // Datei korrupt → Backup versuchen
    try {
      const bak = await fs.readFile(`${TASKS_FILE}.bak`, "utf8");
      console.warn("[Store] Haupt-Tasks-Datei korrupt, lade Backup...");
      return JSON.parse(bak);
    } catch {
      return [];
    }
  }
}

// ── Run-Log (port von OpenClaw run-log.ts) ────────────────────

async function appendRunLog(taskId, entry) {
  await fs.mkdir(RUN_LOG_DIR, { recursive: true });
  const logFile = path.join(RUN_LOG_DIR, `${taskId}.jsonl`);
  const line    = JSON.stringify(entry) + "\n";

  await fs.appendFile(logFile, line, "utf8");

  // Prune wenn Datei zu groß
  try {
    const stat = await fs.stat(logFile);
    if (stat.size > RUN_LOG_MAX_BYTES) {
      const content = await fs.readFile(logFile, "utf8");
      const lines   = content.split("\n").filter(Boolean);
      const kept    = lines.slice(-RUN_LOG_KEEP_LINES);
      await fs.writeFile(logFile, kept.join("\n") + "\n", "utf8");
      console.log(`[RunLog] Pruned ${logFile}: ${lines.length} → ${kept.length} Einträge`);
    }
  } catch {}
}

export async function getRunLog(taskId, limit = 50) {
  const logFile = path.join(RUN_LOG_DIR, `${taskId}.jsonl`);
  try {
    const content = await fs.readFile(logFile, "utf8");
    const lines   = content.split("\n").filter(Boolean);
    return lines.slice(-limit).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).reverse();
  } catch {
    return [];
  }
}

// ── Migration: altes Format → neues Format ───────────────────

function migrateTask(raw) {
  if (raw.schedule) return raw;

  const repeatToEveryMs = { hourly: 3_600_000, daily: 86_400_000, weekly: 604_800_000 };

  let schedule;
  if (raw.repeat && repeatToEveryMs[raw.repeat]) {
    const everyMs  = repeatToEveryMs[raw.repeat];
    const anchorMs = parseAbsoluteTimeMs(raw.executeAt) || Date.now();
    schedule = { kind: "every", everyMs, anchorMs };
  } else {
    schedule = { kind: "at", at: raw.executeAt || new Date().toISOString() };
  }

  return {
    id:            raw.id,
    name:          raw.instruction?.slice(0, 80) || "Task",
    schedule,
    payload:       { kind: "agentTurn", message: raw.instruction || "" },
    deleteAfterRun: !raw.repeat,
    enabled:       !(raw.done),
    sendEmail:     raw.sendEmail || null,
    createdAt:     raw.createdAt || new Date().toISOString(),
    state: {
      nextRunAtMs:        parseAbsoluteTimeMs(raw.executeAt) || null,
      lastRunAtMs:        null,
      consecutiveErrors:  0,
      lastErrorMsg:       null,
      lastAlertAtMs:      null,
    },
  };
}

async function loadTasks() {
  const raw = await loadTasksRaw();
  return (Array.isArray(raw) ? raw : []).map(migrateTask);
}

async function saveTasks(tasks) {
  await atomicWriteJson(TASKS_FILE, tasks);
}

// ── Stagger für Top-of-Hour-Crons (port von OpenClaw stagger.ts) ──

function isTopOfHour(expr) {
  if (!expr) return false;
  // Trifft auf "0 * * * *", "0 9 * * *", "0 */2 * * *" etc.
  const parts = expr.trim().split(/\s+/);
  return parts.length >= 5 && parts[0] === "0";
}

function applyStagger(nextMs, taskId) {
  if (!nextMs) return nextMs;
  // Deterministischer Versatz pro Task (0–5min) basierend auf Task-ID
  let hash = 0;
  for (let i = 0; i < taskId.length; i++) hash = (hash * 31 + taskId.charCodeAt(i)) >>> 0;
  const staggerMs = hash % TOP_OF_HOUR_STAGGER_MS;
  return nextMs + staggerMs;
}

// ── computeNextRunAtMs (Port von OpenClaw src/cron/schedule.ts) ──

const cronCache = new Map();

function getCronInstance(expr, tz) {
  const key = `${tz || ""}\0${expr}`;
  if (!cronCache.has(key)) {
    if (cronCache.size >= 256) {
      cronCache.delete(cronCache.keys().next().value);
    }
    cronCache.set(key, new Cron(expr, { timezone: tz || "UTC", maxRuns: Infinity }));
  }
  return cronCache.get(key);
}

export function computeNextRunAtMs(schedule, nowMs = Date.now(), taskId = "") {
  if (!schedule) return null;

  switch (schedule.kind) {
    case "at": {
      const atMs = parseAbsoluteTimeMs(schedule.at);
      if (atMs == null) return null;
      return atMs > nowMs ? atMs : null;
    }

    case "every": {
      const { everyMs, anchorMs } = schedule;
      if (!everyMs || everyMs <= 0) return null;
      const anchor   = anchorMs ?? nowMs;
      const elapsed  = nowMs - anchor;
      const intervals = Math.ceil(elapsed / everyMs);
      return anchor + intervals * everyMs;
    }

    case "cron": {
      const { expr, tz } = schedule;
      if (!expr) return null;
      try {
        const instance = getCronInstance(expr, tz);
        const next     = instance.nextRun(new Date(nowMs));
        if (!next) return null;
        const nextMs = next.getTime();
        if (nextMs <= nowMs) {
          const retry = instance.nextRun(new Date(nowMs + 1_000));
          if (!retry) return null;
          const retryMs = retry.getTime();
          return isTopOfHour(expr) ? applyStagger(retryMs, taskId) : retryMs;
        }
        return isTopOfHour(expr) ? applyStagger(nextMs, taskId) : nextMs;
      } catch (e) {
        console.error("[Scheduler] Cron-Parse-Fehler:", e.message);
        return null;
      }
    }

    default:
      return null;
  }
}

// ── Failure-Alert (port von OpenClaw delivery.ts / timer.ts) ──

async function sendFailureAlert(task) {
  const nowMs = Date.now();
  const lastAlert = task.state.lastAlertAtMs || 0;

  // Cooldown einhalten
  if (nowMs - lastAlert < ALERT_COOLDOWN) return;

  task.state.lastAlertAtMs = nowMs;

  const msg = `⚠️ **Scheduled Task fehlgeschlagen**\n\n**Task:** ${task.name}\n**Fehler:** ${task.state.lastErrorMsg || "unbekannt"}\n**Aufeinanderfolgende Fehler:** ${task.state.consecutiveErrors}\n**Task-ID:** ${task.id}`;

  if (addInboxFn) {
    await addInboxFn("assistant", msg).catch(e => console.error("[Scheduler] Alert-Inbox-Fehler:", e.message));
  }
  if (addPostfachFn) {
    await addPostfachFn(`⚠️ Task-Fehler: ${task.name.slice(0, 50)}`, msg, "error").catch(() => {});
  }

  console.warn(`[Scheduler] Failure-Alert gesendet für Task "${task.name}"`);
}

// ── Task ausführen ────────────────────────────────────────────

async function executeTask(task) {
  const startMs = Date.now();
  console.log(`[Scheduler] Führe Task aus: "${task.name}" (ID: ${task.id})`);

  const payload = task.payload || { kind: "agentTurn", message: task.name };

  // systemEvent → direkt ins Postfach, kein LLM
  if (payload.kind === "systemEvent") {
    const content = payload.text || task.name;
    if (addPostfachFn) await addPostfachFn(`⏰ ${task.name.slice(0, 60)}`, content, "info");
    if (addInboxFn)    await addInboxFn("assistant", content);
    await appendRunLog(task.id, { ts: new Date().toISOString(), status: "ok", kind: "systemEvent", durationMs: Date.now() - startMs });
    return;
  }

  // agentTurn → Web-Suche + LLM-Zusammenfassung
  const instruction = payload.message || task.name;
  let result = "";
  let searchSource = null;

  if (webSearchFn) {
    try {
      const sr = await webSearchFn(instruction);
      searchSource = sr?.source || null;
      if (sr?.results?.length) {
        result = sr.results.slice(0, 5)
          .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.snippet || ""}\n   ${r.url}`)
          .join("\n\n");
      } else {
        result = `Keine Suchergebnisse gefunden.\n\nQuery: ${instruction}`;
      }
    } catch (e) {
      result = `(Suche fehlgeschlagen: ${e.message})`;
    }
  }

  let model = null;
  if (result && llmClientFn) {
    try {
      const llm = llmClientFn();
      model = llm.model;
      const resp = await llm.client.chat.completions.create({
        model: llm.model,
        messages: [
          { role: "system", content: "Du bist ESO Bot. Fasse die Suchergebnisse kompakt auf Deutsch zusammen. Max 5 Bullet-Points." },
          { role: "user",   content: `Aufgabe: ${instruction}\n\nSuchergebnisse:\n${result}` },
        ],
        max_tokens: 800,
      });
      result = (resp.choices[0].message.content || result)
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .replace(/<\/?think>/gi, "")
        .trim();
    } catch {}
  }

  const content = result || `Aufgabe "${instruction}" wurde ausgeführt (keine Suchergebnisse).`;
  const title   = `⏰ ${task.name.slice(0, 60)}${task.name.length > 60 ? "…" : ""}`;

  if (addInboxFn)    await addInboxFn("assistant", content);
  if (addPostfachFn) await addPostfachFn(title, content, "info");

  if (sendEmailFn && task.sendEmail) {
    try { await sendEmailFn(task.sendEmail, title, content); }
    catch (e) { console.error("[Scheduler] E-Mail Fehler:", e.message); }
  }

  const durationMs = Date.now() - startMs;
  await appendRunLog(task.id, {
    ts: new Date().toISOString(),
    status: "ok",
    kind: "agentTurn",
    searchSource,
    model,
    durationMs,
    summary: content.slice(0, 200),
  });

  console.log(`[Scheduler] Task abgeschlossen: "${task.name}" (${durationMs}ms)`);
}

// ── Scheduler Tick (mit Concurrency-Limit) ────────────────────

async function tick() {
  const tasks   = await loadTasks();
  const nowMs   = Date.now();
  let   changed = false;

  // Fällige Tasks sammeln
  const due = tasks.filter(t =>
    t.enabled &&
    t.state.nextRunAtMs != null &&
    nowMs >= t.state.nextRunAtMs
  );

  if (!due.length) return;

  // Concurrency-Pool: max MAX_CONCURRENT gleichzeitig
  const running = new Set();
  const queue   = [...due];

  async function runOne(task) {
    try {
      await executeTask(task);
      task.state.lastRunAtMs       = nowMs;
      task.state.consecutiveErrors = 0;
      task.state.lastErrorMsg      = null;
    } catch (e) {
      console.error(`[Scheduler] Fehler bei Task "${task.name}" (${task.id}):`, e.message);
      task.state.consecutiveErrors = (task.state.consecutiveErrors || 0) + 1;
      task.state.lastErrorMsg      = e.message;

      await appendRunLog(task.id, {
        ts: new Date().toISOString(),
        status: "error",
        error: e.message,
        consecutiveErrors: task.state.consecutiveErrors,
      }).catch(() => {});

      // Failure-Alert nach ALERT_AFTER aufeinanderfolgenden Fehlern
      if (task.state.consecutiveErrors >= ALERT_AFTER) {
        await sendFailureAlert(task).catch(() => {});
      }

      // Task deaktivieren nach MAX_RETRIES
      if (task.state.consecutiveErrors > MAX_RETRIES) {
        console.warn(`[Scheduler] Task "${task.name}" nach ${MAX_RETRIES} Fehlern deaktiviert.`);
        task.enabled = false;
      }
    }

    // Nächsten Lauf berechnen
    if (task.deleteAfterRun && task.schedule.kind === "at" && task.state.consecutiveErrors === 0) {
      task.enabled = false;
      task.state.nextRunAtMs = null;
    } else if (task.state.consecutiveErrors > 0 && task.enabled) {
      const backoffMs = BACKOFF_TABLE[Math.min(task.state.consecutiveErrors - 1, BACKOFF_TABLE.length - 1)];
      task.state.nextRunAtMs = nowMs + backoffMs;
    } else if (task.enabled) {
      task.state.nextRunAtMs = computeNextRunAtMs(task.schedule, nowMs + 1, task.id);
    }

    changed = true;
  }

  // Worker-Pool
  await new Promise(resolve => {
    let active  = 0;
    let idx     = 0;

    function next() {
      while (active < MAX_CONCURRENT && idx < queue.length) {
        const task = queue[idx++];
        active++;
        runOne(task).finally(() => {
          active--;
          if (idx < queue.length) {
            next();
          } else if (active === 0) {
            resolve();
          }
        });
      }
      if (queue.length === 0) resolve();
    }

    next();
  });

  if (changed) await saveTasks(tasks);
}

// ── Missed-Jobs beim Start nachholen (Port von OpenClaw runMissedJobs) ──

async function runMissedJobs() {
  const tasks  = await loadTasks();
  const nowMs  = Date.now();
  const missed = tasks.filter(t =>
    t.enabled &&
    t.state.nextRunAtMs != null &&
    t.state.nextRunAtMs <= nowMs
  );

  if (!missed.length) return;
  console.log(`[Scheduler] ${missed.length} verpasste Task(s) werden nachgeholt...`);

  const immediate = missed.slice(0, 5);
  const deferred  = missed.slice(5);

  for (const task of immediate) {
    try {
      await executeTask(task);
      task.state.lastRunAtMs       = nowMs;
      task.state.consecutiveErrors = 0;
      if (task.deleteAfterRun && task.schedule.kind === "at") {
        task.enabled = false;
        task.state.nextRunAtMs = null;
      } else {
        task.state.nextRunAtMs = computeNextRunAtMs(task.schedule, nowMs + 1, task.id);
      }
    } catch (e) {
      console.error(`[Scheduler] Fehler beim Nachholen von "${task.name}":`, e.message);
      await appendRunLog(task.id, { ts: new Date().toISOString(), status: "error", error: e.message }).catch(() => {});
    }
  }

  if (deferred.length) {
    console.log(`[Scheduler] ${deferred.length} weitere verpasste Tasks beim nächsten Tick.`);
  }

  await saveTasks(tasks);
}

// ── Public API ────────────────────────────────────────────────

export async function createTask({ name, schedule, payload, deleteAfterRun, sendEmail, instruction, executeAt, repeat }) {
  if (!schedule && executeAt) {
    const repeatToEveryMs = { hourly: 3_600_000, daily: 86_400_000, weekly: 604_800_000 };
    if (repeat && repeatToEveryMs[repeat]) {
      const everyMs  = repeatToEveryMs[repeat];
      const anchorMs = parseAbsoluteTimeMs(executeAt) || Date.now();
      schedule = { kind: "every", everyMs, anchorMs };
    } else {
      schedule = { kind: "at", at: executeAt };
    }
  }

  if (!schedule) throw new Error("schedule (oder executeAt) fehlt");

  const id              = `task-${Date.now()}`;
  const effectiveName   = name || instruction?.slice(0, 80) || "Task";
  const effectivePayload = payload || { kind: "agentTurn", message: instruction || effectiveName };
  const isOneShot       = (deleteAfterRun !== undefined) ? deleteAfterRun : schedule.kind === "at";
  const nextRunAtMs     = computeNextRunAtMs(schedule, Date.now(), id);

  const task = {
    id,
    name:          effectiveName,
    schedule,
    payload:       effectivePayload,
    deleteAfterRun: isOneShot,
    enabled:       true,
    sendEmail:     sendEmail || null,
    createdAt:     new Date().toISOString(),
    state: {
      nextRunAtMs,
      lastRunAtMs:       null,
      consecutiveErrors: 0,
      lastErrorMsg:      null,
      lastAlertAtMs:     null,
    },
  };

  const tasks = await loadTasks();
  tasks.push(task);
  await saveTasks(tasks);
  console.log(`[Scheduler] Task angelegt: "${effectiveName}" — nächster Lauf: ${nextRunAtMs ? new Date(nextRunAtMs).toISOString() : "n/a"}`);
  return task;
}

export async function listTasks() {
  const tasks = await loadTasks();
  return tasks.filter(t => t.enabled);
}

export async function deleteTask(id) {
  const tasks   = await loadTasks();
  const updated = tasks.filter(t => t.id !== id);
  await saveTasks(updated);
}

export function startScheduler({ webSearch, addPostfach, addInbox, sendEmail, makeLLMClient }) {
  webSearchFn   = webSearch;
  addPostfachFn = addPostfach;
  addInboxFn    = addInbox;
  sendEmailFn   = sendEmail;
  llmClientFn   = makeLLMClient;

  runMissedJobs().catch(e => console.error("[Scheduler] Missed-Jobs Fehler:", e.message));
  setInterval(() => tick().catch(e => console.error("[Scheduler] Tick-Fehler:", e.message)), TICK_MS);
  console.log("[Scheduler] Gestartet — prüft jede Minute auf fällige Tasks.");
}
