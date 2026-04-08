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

export async function sendChatMessage(messages, model) {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ messages, model })
  });
  if (!res.ok) throw new Error(`Chat API error: ${res.status}`);
  return res.json();
}

export async function sendAgentTask(task) {
  const res = await fetch(`${BASE_URL}/api/agent`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(task)
  });
  if (!res.ok) throw new Error(`Agent API error: ${res.status}`);
  return res.json();
}

export async function getAgentStatus() {
  const res = await fetch(`${BASE_URL}/api/agent`, {
    method: "GET",
    headers: headers()
  });
  if (!res.ok) throw new Error(`Agent status error: ${res.status}`);
  return res.json();
}