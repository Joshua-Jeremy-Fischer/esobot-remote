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

export async function runWorkflow(task) {
  const res = await fetch(`${BASE_URL}/api/workflow`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ task })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Workflow API error: ${res.status}`);
  }
  return res.json();
}

/**
 * Stream workflow agent steps via SSE.
 * Returns the EventSource — caller must call .close() on unmount.
 * onStep(data)  — called for each intermediate agent node
 * onDone(data)  — called once with the final result (data.done === true)
 * onError(err)  — called on connection error
 */
export function streamWorkflow(task, onStep, onDone, onError) {
  const url = `${BASE_URL}/api/workflow/stream?task=${encodeURIComponent(task)}`;
  const es = new EventSource(url);

  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.done) {
        onDone(data);
        es.close();
      } else {
        onStep(data);
      }
    } catch {
      // ignore malformed frames
    }
  };

  es.onerror = (err) => {
    onError(err);
    es.close();
  };

  return es;
}