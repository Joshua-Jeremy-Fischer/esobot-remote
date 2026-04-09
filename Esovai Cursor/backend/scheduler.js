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
 *
 * Backward-Compat: Alte Tasks mit { executeAt, repeat, instruction }
 * werden beim Laden automatisch ins neue Format migriert.
 */

import fs from "fs/promises";
import { Cron } from "croner";
import { parseAbsoluteTimeMs } from "./cron-parse.js";

const TASKS_FILE = "/data/scheduled-tasks.json";
const TICK_MS    = 60_000;  // jede Minute prüfen

// Exponential-Backoff-Tabelle (in ms), port von OpenClaw service/timer.ts
const BACKOFF_TABLE = [30_000, 60_000, 300_000, 900_000, 3_600_000];
const MAX_RETRIES   = 3;

// Dependency-Injections (werden via startScheduler() gesetzt)
let webSearchFn   = null;
let addPostfachFn = null;
let addInboxFn    = null;
let sendEmailFn   = null;
let llmClientFn   = null;

// ── Migration: altes Format → neues Format ───────────────────

function migrateTask(raw) {
  // Bereits migriert wenn schedule-Objekt vorhanden
  if (raw.schedule) return raw;

  // Legacy-Felder: executeAt (ISO), repeat ("daily"|"hourly"|"weekly"), instruction
  const repeatToEveryMs = { hourly: 3_600_000, daily: 86_400_000, weekly: 604_800_000 };

  let schedule;
  if (raw.repeat && repeatToEveryMs[raw.repeat]) {
    const everyMs   = repeatToEveryMs[raw.repeat];
    const anchorMs  = parseAbsoluteTimeMs(raw.executeAt) || Date.now();
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
    },
  };
}

// ── Task Storage ──────────────────────────────────────────────

async function loadTasks() {
  try {
    const raw = JSON.parse(await fs.readFile(TASKS_FILE, "utf8"));
    return (Array.isArray(raw) ? raw : []).map(migrateTask);
  } catch {
    return [];
  }
}

async function saveTasks(tasks) {
  await fs.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2));
}

// ── computeNextRunAtMs (Port von OpenClaw src/cron/schedule.ts) ──

// Croner-Instanz-Cache (keyed by "tz\0expr")
const cronCache = new Map();

function getCronInstance(expr, tz) {
  const key = `${tz || ""}\0${expr}`;
  if (!cronCache.has(key)) {
    if (cronCache.size >= 256) {
      // Ältesten Eintrag entfernen (einfaches LRU-Ersatz)
      cronCache.delete(cronCache.keys().next().value);
    }
    cronCache.set(key, new Cron(expr, { timezone: tz || "UTC", maxRuns: Infinity }));
  }
  return cronCache.get(key);
}

/**
 * Berechnet den nächsten Ausführungszeitpunkt für einen Schedule.
 * Gibt null zurück wenn kein weiterer Lauf geplant ist (z.B. "at" bereits vorbei).
 * Port von OpenClaw src/cron/schedule.ts → computeNextRunAtMs
 */
export function computeNextRunAtMs(schedule, nowMs = Date.now()) {
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
      const anchor = anchorMs ?? nowMs;
      const elapsed = nowMs - anchor;
      const intervals = Math.ceil(elapsed / everyMs);
      return anchor + intervals * everyMs;
    }

    case "cron": {
      const { expr, tz } = schedule;
      if (!expr) return null;
      try {
        const instance = getCronInstance(expr, tz);
        const start    = new Date(nowMs);
        const next     = instance.nextRun(start);
        if (!next) return null;
        const nextMs = next.getTime();
        // Croner-Workaround: falls next in der Vergangenheit → retry mit +1s
        if (nextMs <= nowMs) {
          const retry = instance.nextRun(new Date(nowMs + 1_000));
          return retry ? retry.getTime() : null;
        }
        return nextMs;
      } catch (e) {
        console.error("[Scheduler] Cron-Parse-Fehler:", e.message);
        return null;
      }
    }

    default:
      return null;
  }
}

// ── Task ausführen ────────────────────────────────────────────

async function executeTask(task) {
  console.log(`[Scheduler] Führe Task aus: "${task.name}" (ID: ${task.id})`);

  const payload = task.payload || { kind: "agentTurn", message: task.name };

  // systemEvent → direkt ins Postfach, kein LLM
  if (payload.kind === "systemEvent") {
    const content = payload.text || task.name;
    if (addPostfachFn) await addPostfachFn(`⏰ ${task.name.slice(0, 60)}`, content, "info");
    if (addInboxFn)    await addInboxFn("assistant", content);
    return;
  }

  // agentTurn → Web-Suche + LLM-Zusammenfassung
  const instruction = payload.message || task.name;
  let result = "";

  if (webSearchFn) {
    try {
      const sr = await webSearchFn(instruction);
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

  if (result && llmClientFn) {
    try {
      const { client, model } = llmClientFn();
      const resp = await client.chat.completions.create({
        model,
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

  console.log(`[Scheduler] Task abgeschlossen: "${task.name}"`);
}

// ── Scheduler Tick ────────────────────────────────────────────

async function tick() {
  const tasks   = await loadTasks();
  const nowMs   = Date.now();
  let   changed = false;

  for (const task of tasks) {
    if (!task.enabled) continue;
    if (task.state.nextRunAtMs == null) continue;
    if (nowMs < task.state.nextRunAtMs) continue;

    try {
      await executeTask(task);
      task.state.lastRunAtMs       = nowMs;
      task.state.consecutiveErrors = 0;
      task.state.lastErrorMsg      = null;
    } catch (e) {
      console.error(`[Scheduler] Fehler bei Task "${task.name}" (${task.id}):`, e.message);
      task.state.consecutiveErrors = (task.state.consecutiveErrors || 0) + 1;
      task.state.lastErrorMsg      = e.message;

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
      // Backoff
      const backoffMs = BACKOFF_TABLE[Math.min(task.state.consecutiveErrors - 1, BACKOFF_TABLE.length - 1)];
      task.state.nextRunAtMs = nowMs + backoffMs;
    } else if (task.enabled) {
      task.state.nextRunAtMs = computeNextRunAtMs(task.schedule, nowMs + 1);
    }

    changed = true;
  }

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

  // Bis zu 5 sofort, Rest mit 5s-Stagger
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
        task.state.nextRunAtMs = computeNextRunAtMs(task.schedule, nowMs + 1);
      }
    } catch (e) {
      console.error(`[Scheduler] Fehler beim Nachholen von "${task.name}":`, e.message);
    }
  }

  // Deferred Tasks werden beim nächsten regulären Tick aufgeräumt
  if (deferred.length) {
    console.log(`[Scheduler] ${deferred.length} weitere verpasste Tasks beim nächsten Tick.`);
  }

  await saveTasks(tasks);
}

// ── Public API ────────────────────────────────────────────────

/**
 * Legt einen neuen Task an.
 *
 * Neue API:
 *   createTask({ name, schedule, payload, deleteAfterRun, sendEmail })
 *
 * Legacy-API (backward-compat):
 *   createTask({ instruction, executeAt, repeat, sendEmail })
 */
export async function createTask({ name, schedule, payload, deleteAfterRun, sendEmail, instruction, executeAt, repeat }) {
  // Legacy-Compat: instruction + executeAt + repeat → neues Format
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

  const effectiveName = name || instruction?.slice(0, 80) || "Task";
  const effectivePayload = payload || { kind: "agentTurn", message: instruction || effectiveName };
  const isOneShot = (deleteAfterRun !== undefined) ? deleteAfterRun : schedule.kind === "at";

  const nextRunAtMs = computeNextRunAtMs(schedule, Date.now());

  const task = {
    id:            `task-${Date.now()}`,
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

  // Verpasste Tasks nachholen, dann regulärer Tick-Interval
  runMissedJobs().catch(e => console.error("[Scheduler] Missed-Jobs Fehler:", e.message));
  setInterval(() => tick().catch(e => console.error("[Scheduler] Tick-Fehler:", e.message)), TICK_MS);
  console.log("[Scheduler] Gestartet — prüft jede Minute auf fällige Tasks.");
}
