const BASE_URL = "";

function getToken() {
  return localStorage.getItem("kimi_token") || "";
}

function headers() {
  const provider = localStorage.getItem("kimi_provider") || "base44";
  const model = localStorage.getItem("kimi_model") || "";
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${getToken()}`,
    "X-Provider": provider,
    ...(model ? { "X-Model": model } : {})
  };
}

function throwApiError(res, context) {
  if (res.status === 401) {
    const missing = !getToken();
    throw new Error(
      missing
        ? `Kein API-Token gesetzt — bitte in Einstellungen eintragen.`
        : `Ungültiger API-Token (401) — bitte in Einstellungen korrigieren.`
    );
  }
  throw new Error(`${context}: ${res.status}`);
}

export async function sendChatMessage(messages, model) {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ messages, model })
  });
  if (!res.ok) throwApiError(res, "Chat API Fehler");
  return res.json();
}

export async function sendAgentTask(task) {
  const res = await fetch(`${BASE_URL}/api/agent`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(task)
  });
  if (!res.ok) throwApiError(res, "Agent API Fehler");
  return res.json();
}

export async function getAgentStatus() {
  const res = await fetch(`${BASE_URL}/api/agent`, {
    method: "GET",
    headers: headers()
  });
  if (!res.ok) throwApiError(res, "Agent Status Fehler");
  return res.json();
}

// ── Postfach ─────────────────────────────────────────────────

export async function getPostfach() {
  const res = await fetch(`${BASE_URL}/api/agent/postfach`, {
    headers: headers()
  });
  if (!res.ok) throw new Error(`Postfach error: ${res.status}`);
  return res.json(); // { entries: [...] }
}

export async function markPostfachRead(id) {
  const res = await fetch(`${BASE_URL}/api/agent/postfach/${id}/read`, {
    method: "POST",
    headers: headers()
  });
  if (!res.ok) throw new Error(`Mark read error: ${res.status}`);
  return res.json();
}

export async function deletePostfachEntry(id) {
  const res = await fetch(`${BASE_URL}/api/agent/postfach/${id}`, {
    method: "DELETE",
    headers: headers()
  });
  if (!res.ok) throw new Error(`Delete error: ${res.status}`);
  return res.json();
}

export async function deleteAllReadPostfach() {
  const res = await fetch(`${BASE_URL}/api/agent/postfach`, {
    method: "DELETE",
    headers: headers()
  });
  if (!res.ok) throw new Error(`Delete all read error: ${res.status}`);
  return res.json();
}

// ── Agent Inbox (ESO Bot Chat) ────────────────────────────────

export async function getAgentInbox() {
  const res = await fetch(`${BASE_URL}/api/agent/inbox`, {
    headers: headers()
  });
  if (!res.ok) throw new Error(`Inbox error: ${res.status}`);
  return res.json(); // { messages: [...] }
}

export async function sendAgentInboxMessage(message) {
  const res = await fetch(`${BASE_URL}/api/agent/inbox`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ message })
  });
  if (!res.ok) throw new Error(`Inbox send error: ${res.status}`);
  return res.json(); // { messages: [...] }
}

// ── Jobs ──────────────────────────────────────────────────────

export async function getJobs() {
  const res = await fetch(`${BASE_URL}/api/agent/jobs`, {
    headers: headers()
  });
  if (!res.ok) throw new Error(`Jobs error: ${res.status}`);
  return res.json(); // { jobs: [...], lastRun, nextRun }
}

export async function triggerJobCrawl() {
  const res = await fetch(`${BASE_URL}/api/agent/jobs/run`, {
    method: "POST",
    headers: headers()
  });
  if (!res.ok) throw new Error(`Job crawl error: ${res.status}`);
  return res.json();
}

// ── Monitor ───────────────────────────────────────────────────

export async function getMonitorStatus() {
  const res = await fetch(`${BASE_URL}/api/monitor/status`, {
    headers: headers()
  });
  if (!res.ok) throw new Error(`Monitor error: ${res.status}`);
  return res.json(); // { services: [...], disk, memory, allOk }
}
