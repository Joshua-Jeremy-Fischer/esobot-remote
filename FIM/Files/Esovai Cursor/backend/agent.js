import express from "express";

/** @typedef {{ getProviderClient: (name: string) => any, resolveProviderName: (name: string) => string, defaultProvider: string, chatDefaultMaxTokens: number, chatMaxTokensCap: number }} AgentDeps */

// ── Permissions (wie eso-bot/permissions.js, In-Memory) ──────────
const CEILING = {
  shell: process.env.ALLOW_SHELL === "true",
  web:   process.env.ALLOW_WEB !== "false",
  files: process.env.ALLOW_FILES !== "false",
  git:   process.env.ALLOW_GIT === "true",
};

const permissions = { ...CEILING };

function getPermissions() {
  return { ...permissions };
}

function getCeiling() {
  return { ...CEILING };
}

function setPermissions(updates) {
  for (const [key, val] of Object.entries(updates)) {
    if (!(key in permissions)) continue;
    const requested = Boolean(val);
    permissions[key] = requested && CEILING[key];
  }
  return { ...permissions };
}

// ── UI `filesystem` ↔ intern `files` ───────────────────────────────
function permissionsToUi(data) {
  if (!data || typeof data !== "object") return {};
  const cur = data.current ?? data.permissions ?? data;
  return {
    shell:      !!cur.shell,
    web:        !!cur.web,
    filesystem: !!cur.files,
    git:        !!cur.git,
  };
}

function permissionsFromUi(body) {
  const out = { ...body };
  if (Object.prototype.hasOwnProperty.call(out, "filesystem")) {
    out.files = out.filesystem;
    delete out.filesystem;
  }
  return out;
}

/** @param {AgentDeps} deps */
export function createAgentRouter(deps) {
  const {
    getProviderClient,
    resolveProviderName,
    defaultProvider,
    chatDefaultMaxTokens,
    chatMaxTokensCap,
  } = deps;

  const router = express.Router();

  const AGENT_MAX_TOKENS = Number(process.env.AGENT_MAX_TOKENS ?? 4000);

  // POST /api/agent — eine LLM-Runde (kein Sandbox/Tool-Loop ohne eso-bot)
  router.post("/", async (req, res) => {
    const { messages, system } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages[] fehlt oder leer" });
    }
    for (const m of messages) {
      if (!m.role || typeof m.content !== "string") {
        return res.status(400).json({ error: "Ungültiges messages-Format" });
      }
    }

    const providerName = resolveProviderName(req.headers["x-provider"] || defaultProvider);
    const pc = getProviderClient(providerName);
    if (!pc) return res.status(400).json({ error: `Unbekannter Provider: ${providerName}` });
    if (pc.error) return res.status(400).json({ error: pc.error });

    const model =
      (typeof req.body.model === "string" && req.body.model.trim()) || req.headers["x-model"] || pc.model;

    const requestedMax = Number(req.body.max_tokens ?? chatDefaultMaxTokens);
    const safeReq =
      Number.isFinite(requestedMax) && requestedMax > 0 ? requestedMax : chatDefaultMaxTokens;
    const max_tokens =
      chatMaxTokensCap > 0 ? Math.min(safeReq, chatMaxTokensCap, AGENT_MAX_TOKENS) : Math.min(safeReq, AGENT_MAX_TOKENS);

    try {
      const response = await pc.client.chat.completions.create({
        model,
        messages: [
          system ? { role: "system", content: system } : null,
          ...messages,
        ].filter(Boolean),
        max_tokens,
      });

      const msg = response.choices[0].message;
      return res.json({
        content:    msg.content || "",
        toolCalls:  [],
        iterations: 1,
        model,
      });
    } catch (err) {
      console.error("[AGENT]", err.message);
      return res.status(500).json({ error: err.message || "Agent-Anfrage fehlgeschlagen" });
    }
  });

  router.get("/permissions", (_req, res) => {
    return res.json(permissionsToUi({ current: getPermissions(), ceiling: getCeiling() }));
  });

  router.post("/permissions", (req, res) => {
    const payload = permissionsFromUi(req.body || {});
    const updated = setPermissions(payload);
    return res.json(permissionsToUi({ current: updated }));
  });

  return router;
}
