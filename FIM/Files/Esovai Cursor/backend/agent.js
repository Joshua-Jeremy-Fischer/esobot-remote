import express from "express";

const AGENT_BASE  = process.env.AGENT_BASE_URL    || "http://kimi-agent:3020";
const AGENT_TOKEN = process.env.AGENT_BEARER_TOKEN || "";

export function createAgentRouter() {
  const router = express.Router();

  // POST /api/agent — Task erstellen + starten
  router.post("/", async (req, res) => {
    if (!AGENT_TOKEN) {
      return res.status(503).json({ error: "Agent nicht konfiguriert (AGENT_BEARER_TOKEN fehlt)" });
    }

    const { prompt, allowed_tools, autonomy } = req.body;
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ error: "prompt fehlt" });
    }

    try {
      const createRes = await fetch(`${AGENT_BASE}/tasks`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${AGENT_TOKEN}`,
        },
        body: JSON.stringify({ prompt, allowed_tools, autonomy }),
      });

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        return res.status(createRes.status).json({ error: err.error || "Agent-Fehler beim Erstellen" });
      }

      const { id } = await createRes.json();

      // Task starten (fire-and-forget)
      fetch(`${AGENT_BASE}/tasks/${id}/run`, {
        method:  "POST",
        headers: { "Authorization": `Bearer ${AGENT_TOKEN}` },
      }).catch(() => {});

      res.status(202).json({ taskId: id, status: "running" });
    } catch (err) {
      console.error("Agent proxy error:", err.message);
      res.status(502).json({ error: "Agent-Dienst nicht erreichbar" });
    }
  });

  // GET /api/agent/:taskId/status — Task-Status abfragen
  router.get("/:taskId/status", async (req, res) => {
    if (!AGENT_TOKEN) {
      return res.status(503).json({ error: "Agent nicht konfiguriert" });
    }

    try {
      const taskRes = await fetch(`${AGENT_BASE}/tasks/${req.params.taskId}`, {
        headers: { "Authorization": `Bearer ${AGENT_TOKEN}` },
      });

      if (!taskRes.ok) {
        const err = await taskRes.json().catch(() => ({}));
        return res.status(taskRes.status).json({ error: err.error || "Task nicht gefunden" });
      }

      const task = await taskRes.json();
      res.json({
        taskId:      task.id,
        status:      task.status,
        result:      task.result_text  ?? null,
        error:       task.error_text   ?? null,
        pendingTool: task.pending_tool ?? null,
        createdAt:   task.created_at,
        updatedAt:   task.updated_at,
      });
    } catch (err) {
      console.error("Agent status error:", err.message);
      res.status(502).json({ error: "Agent-Dienst nicht erreichbar" });
    }
  });

  // GET /api/agent — alle Tasks auflisten
  router.get("/", async (req, res) => {
    if (!AGENT_TOKEN) {
      return res.status(503).json({ error: "Agent nicht konfiguriert" });
    }

    try {
      const listRes = await fetch(`${AGENT_BASE}/tasks`, {
        headers: { "Authorization": `Bearer ${AGENT_TOKEN}` },
      });

      if (!listRes.ok) {
        return res.status(listRes.status).json({ error: "Tasks konnten nicht geladen werden" });
      }

      res.json(await listRes.json());
    } catch (err) {
      console.error("Agent list error:", err.message);
      res.status(502).json({ error: "Agent-Dienst nicht erreichbar" });
    }
  });

  return router;
}
