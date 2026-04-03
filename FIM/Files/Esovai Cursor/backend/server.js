import express from "express";
import OpenAI from "openai";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import fs from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { createAuthRouter } from "./auth.js";
import { createAgentRouter } from "./agent.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Provider Registry ──────────────────────────────────────
const PROVIDER_REGISTRY = {
  nvidia: {
    apiKey:  () => process.env.NVIDIA_API_KEY  || "",
    baseURL: () => "https://integrate.api.nvidia.com/v1",
    model:   () => process.env.NVIDIA_MODEL    || "moonshotai/kimi-k2-instruct-0905",
  },
  "opencode-go": {
    apiKey:  () => process.env.OPENCODE_API_KEY  || "",
    baseURL: () => process.env.OPENCODE_BASE_URL || "https://opencode.ai/zen/go/v1",
    model:   () => process.env.OPENCODE_MODEL    || "opencode-go/kimi-k2.5",
  },
  ollama: {
    apiKey:  () => "ollama",
    baseURL: () => process.env.OLLAMA_BASE_URL  || "http://ollama:11434/v1",
    model:   () => process.env.OLLAMA_MODEL     || "llama3.1:8b",
  },
  "github-copilot": {
    apiKey:  () => process.env.COPILOT_TOKEN    || "",
    baseURL: () => "https://api.githubcopilot.com",
    model:   () => process.env.COPILOT_MODEL    || "gpt-4o",
  },
  groq: {
    apiKey:  () => process.env.GROQ_API_KEY     || "",
    baseURL: () => process.env.GROQ_BASE_URL    || "https://api.groq.com/openai/v1",
    model:   () => process.env.GROQ_MODEL       || "llama-3.3-70b-versatile",
  },
  /** OpenAI-kompatibel (LM Studio, vLLM, …) — CUSTOM_BASE_URL in .env */
  custom: {
    apiKey:  () => process.env.CUSTOM_API_KEY   || "lm-studio",
    baseURL: () => {
      let u = (process.env.CUSTOM_BASE_URL || "").trim().replace(/\/$/, "");
      if (!u) return "";
      if (!/\/v1$/i.test(u)) u += "/v1";
      return u;
    },
    model:   () => process.env.CUSTOM_MODEL      || "local-model",
  },
  // HINWEIS: Anthropic nutzt /v1/messages (kein OpenAI-Format) — noch nicht unterstützt
  // anthropic: { ... },
};

/** UI-IDs (models.dev / Kimikami) → interner Provider */
const PROVIDER_ALIASES = {
  "opencode-zen": "opencode-go",
  lmstudio:       "custom",
};

const VALID_PROVIDERS = new Set(Object.keys(PROVIDER_REGISTRY));

function resolveProviderName(name) {
  const n = (name || "").trim();
  if (!n) return DEFAULT_PROVIDER;
  return PROVIDER_ALIASES[n] || n;
}

// Backward compat: LLM_PROVIDER → DEFAULT_PROVIDER
const DEFAULT_PROVIDER = process.env.DEFAULT_PROVIDER
  || process.env.LLM_PROVIDER
  || "nvidia";

// Chat Token-Limits (konfigurierbar per .env)
// - CHAT_DEFAULT_MAX_TOKENS: Default pro Request (falls kein req.body.max_tokens gesetzt ist)
// - CHAT_MAX_TOKENS_CAP: harte Obergrenze; 0 oder negativ = kein Cap
const CHAT_DEFAULT_MAX_TOKENS = Number(process.env.CHAT_DEFAULT_MAX_TOKENS ?? 2000);
const CHAT_MAX_TOKENS_CAP = Number(process.env.CHAT_MAX_TOKENS_CAP ?? 12000);

// ── Startup Env-Check ──────────────────────────────────────
const PROVIDER_KEY_REQUIREMENTS = {
  nvidia:        "NVIDIA_API_KEY",
  "opencode-go": "OPENCODE_API_KEY",
  groq:          "GROQ_API_KEY",
};

const REQUIRED_ENV = ["ALLOWED_TOKEN", "FRONTEND_ORIGIN"];
if (!VALID_PROVIDERS.has(DEFAULT_PROVIDER)) {
  console.error(`FATAL: DEFAULT_PROVIDER "${DEFAULT_PROVIDER}" unbekannt. Erlaubt: ${[...VALID_PROVIDERS].join(", ")}`);
  process.exit(1);
}
const providerKeyReq = PROVIDER_KEY_REQUIREMENTS[DEFAULT_PROVIDER];
if (providerKeyReq) REQUIRED_ENV.push(providerKeyReq);

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`FATAL: "${key}" fehlt in .env — Server startet nicht.`);
    process.exit(1);
  }
}

if (DEFAULT_PROVIDER === "github-copilot" && !process.env.GITHUB_CLIENT_ID) {
  console.warn("WARN: DEFAULT_PROVIDER=github-copilot aber GITHUB_CLIENT_ID fehlt — /auth/github wird nicht funktionieren.");
}

// ── FIM-Check ──────────────────────────────────────────────
const HASHES_FILE = path.join(__dirname, ".fim_hashes.json");

function fimCheck() {
  if (!fs.existsSync(HASHES_FILE)) {
    console.error("FIM FATAL: .fim_hashes.json fehlt — Server stoppt.");
    process.exit(1);
  }
  const known = JSON.parse(fs.readFileSync(HASHES_FILE));
  for (const [file, expectedHash] of Object.entries(known)) {
    const full = path.join(__dirname, file);
    let actual;
    try {
      actual = crypto.createHash("sha256").update(fs.readFileSync(full)).digest("hex");
    } catch {
      console.error(`FIM FATAL: ${file} nicht lesbar — Server stoppt.`);
      process.exit(1);
    }
    if (actual !== expectedHash) {
      console.error(`FIM FAIL: ${file} wurde verändert! Server stoppt.`);
      process.exit(1);
    }
  }
  console.log("FIM: OK ✓");
}

fimCheck();

// ── Per-Request Provider Client Factory ───────────────────
function getProviderClient(providerName) {
  const resolved = resolveProviderName(providerName);
  if (!VALID_PROVIDERS.has(resolved)) return null;
  const cfg = PROVIDER_REGISTRY[resolved];
  const apiKey = cfg.apiKey();
  if (resolved === "custom") {
    const base = (process.env.CUSTOM_BASE_URL || "").trim();
    if (!base) return { error: "CUSTOM_BASE_URL fehlt in .env (OpenAI-kompatibler Endpoint)" };
  }
  // Prüfen ob Key vorhanden (außer ollama, das keinen Key braucht)
  if (resolved !== "ollama" && resolved !== "github-copilot" && resolved !== "custom" && !apiKey) {
    return { error: `API Key für Provider "${resolved}" fehlt in .env` };
  }
  if (resolved === "github-copilot" && !apiKey) {
    return { error: "GitHub Copilot nicht verbunden — zuerst /auth/github aufrufen" };
  }
  return {
    client: new OpenAI({ apiKey, baseURL: cfg.baseURL() }),
    model:  cfg.model(),
  };
}

// ── Express ────────────────────────────────────────────────
const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_ORIGIN }));
app.use(express.json({ limit: "10mb" }));

// 1. Health — keine Auth
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// 2. Auth routes — VOR ALLOWED_TOKEN Guard (GitHub OAuth callback kommt ohne Bearer)
app.use("/auth", createAuthRouter());

// 3. Auth Guard — timing-safe
function timingSafeCompare(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

app.use((req, res, next) => {
  const token = req.headers["authorization"]?.replace("Bearer ", "") ?? "";
  if (!token || !timingSafeCompare(token, process.env.ALLOWED_TOKEN)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

// 4. Rate Limit auf /api/chat — CVE-2026-30827 Fix
// Standard-keyGenerator von express-rate-limit ≥8.3 (inkl. CVE-2026-30827-Fix für IPv4-mapped IPv6)
app.use("/api/chat", rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Agent (in-process, kein eso-bot-Container): teurer als reiner Chat → eigenes Limit
app.use("/api/agent", rateLimit({
  windowMs: 60_000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
}));

// 5. Provider Info Endpoints
app.get("/api/providers", (_req, res) => {
  res.json({
    default:   DEFAULT_PROVIDER,
    available: [...VALID_PROVIDERS],
  });
});

// models.dev Cache — stündlich aktualisiert
let modelsCache = { data: null, fetchedAt: 0 };

async function getModelsFromDev() {
  const now = Date.now();
  if (modelsCache.data && now - modelsCache.fetchedAt < 60 * 60 * 1000) {
    return modelsCache.data;
  }
  try {
    const res = await fetch("https://models.dev/api.json", {
      headers: { "User-Agent": "KimiKami/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`models.dev status ${res.status}`);
    const data = await res.json();
    modelsCache = { data, fetchedAt: now };
    return data;
  } catch (err) {
    console.warn("models.dev fetch fehlgeschlagen:", err.message);
    return modelsCache.data || {};
  }
}

// GET /api/models — Modelle für einen Provider von models.dev
app.get("/api/models", async (req, res) => {
  const rawName = req.headers["x-provider"] || DEFAULT_PROVIDER;
  const providerName = resolveProviderName(rawName);
  const cfg = PROVIDER_REGISTRY[providerName];
  if (!cfg) return res.status(400).json({ error: `Unbekannter Provider: ${providerName}` });

  try {
    const allModels = await getModelsFromDev();
    // models.dev gibt Objekt: { "openai": { models: [...] }, ... }
    const devKey = rawName in allModels ? rawName : providerName;
    const providerModels = allModels[devKey]?.models || [];
    res.json({
      provider: providerName,
      default:  cfg.model(),
      models:   providerModels.length > 0
        ? providerModels.map(m => ({ id: m.id, name: m.name || m.id }))
        : [{ id: cfg.model(), name: cfg.model() }],
    });
  } catch (err) {
    res.json({
      provider: providerName,
      default:  cfg.model(),
      models:   [{ id: cfg.model(), name: cfg.model() }],
    });
  }
});

// GET /api/models/all — alle Provider + Modelle von models.dev
app.get("/api/models/all", async (_req, res) => {
  try {
    const allModels = await getModelsFromDev();
    res.json(allModels);
  } catch (err) {
    res.status(500).json({ error: "models.dev nicht erreichbar" });
  }
});

// 6. Chat Endpoint
app.post("/api/chat", async (req, res) => {
  const providerName = req.headers["x-provider"] || DEFAULT_PROVIDER;
  const pc = getProviderClient(providerName);
  if (!pc) return res.status(400).json({ error: `Unbekannter Provider: ${providerName}` });
  if (pc.error) return res.status(400).json({ error: pc.error });
  // X-Model Header überschreibt das Provider-Default-Modell
  const model = req.headers["x-model"] || pc.model;

  const { messages, system } = req.body;
  const requestedMaxTokens = Number(req.body.max_tokens ?? CHAT_DEFAULT_MAX_TOKENS);
  const safeRequestedMaxTokens = Number.isFinite(requestedMaxTokens) && requestedMaxTokens > 0
    ? requestedMaxTokens
    : CHAT_DEFAULT_MAX_TOKENS;
  const max_tokens = CHAT_MAX_TOKENS_CAP > 0
    ? Math.min(safeRequestedMaxTokens, CHAT_MAX_TOKENS_CAP)
    : safeRequestedMaxTokens;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages[] fehlt oder leer" });
  }
  for (const m of messages) {
    if (!m.role || typeof m.content !== "string") {
      return res.status(400).json({ error: "Ungültiges messages-Format" });
    }
  }

  try {
    const response = await pc.client.chat.completions.create({
      model,
      messages: [
        system ? { role: "system", content: system } : null,
        ...messages,
      ].filter(Boolean),
      max_tokens,
    });

    res.json({
      content:  response.choices[0].message.content,
      usage:    response.usage,
      provider: providerName,
      model,
    });
  } catch (err) {
    console.error("LLM Error:", err.message);
    res.status(500).json({ error: "Interner Fehler" });
  }
});

// 6a. Base44-Compat: Karteikarten / InvokeLLM → strukturiertes JSON vom aktuellen Provider
app.post("/api/invoke-llm", async (req, res) => {
  const providerName = req.headers["x-provider"] || DEFAULT_PROVIDER;
  const pc = getProviderClient(providerName);
  if (!pc) return res.status(400).json({ error: `Unbekannter Provider: ${providerName}` });
  if (pc.error) return res.status(400).json({ error: pc.error });
  const model = req.headers["x-model"] || pc.model;
  const { prompt, response_json_schema } = req.body ?? {};
  if (typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "prompt (string) fehlt" });
  }
  const cap = Number(process.env.INVOKE_LLM_MAX_TOKENS ?? 8192);
  const max_tokens = Number.isFinite(cap) && cap > 0 ? cap : 8192;
  let system = "Du antwortest ausschließlich mit EINEM gültigen JSON-Objekt (kein Markdown, keine Code-Fences, kein Text davor oder danach).";
  if (response_json_schema) {
    system += " Erfülle diese JSON-Struktur: " + JSON.stringify(response_json_schema).slice(0, 6000);
  }
  try {
    const response = await pc.client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      max_tokens,
    });
    let raw = (response.choices[0].message.content || "").trim();
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/```$/m, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
      else throw new Error("Kein JSON in der Modellantwort");
    }
    return res.json(parsed);
  } catch (err) {
    console.error("invoke-llm:", err.message);
    return res.status(500).json({ error: err.message || "invoke-llm fehlgeschlagen" });
  }
});

// 6b. Base44-Compat: Server-Functions (Frontend ruft Gl.functions.invoke → /api/functions/:name)
// Ohne Base44-Cloud: sinnvolle Defaults, damit die UI nicht abstürzt.
app.post("/api/functions/:name", (req, res) => {
  const name = req.params.name;
  if (name === "githubCopilotAuth") {
    return res.json({
      error: "github_copilot_auth_via_base44_disabled",
      hint: "GitHub-Anmeldung für das Backend: /auth/github (OAuth). Copilot-Token in .env: COPILOT_TOKEN.",
    });
  }
  res.status(404).json({ error: `Unbekannte Function: ${name}` });
});

// 7. Agent (Rate-Limit siehe oben auf /api/agent)
app.use(
  "/api/agent",
  createAgentRouter({
    getProviderClient,
    resolveProviderName,
    defaultProvider: DEFAULT_PROVIDER,
    chatDefaultMaxTokens: CHAT_DEFAULT_MAX_TOKENS,
    chatMaxTokensCap: CHAT_MAX_TOKENS_CAP,
  })
);

app.listen(process.env.PORT || 3010, () =>
  console.log(`✓ Backend | Provider: ${DEFAULT_PROVIDER} | Model: ${PROVIDER_REGISTRY[DEFAULT_PROVIDER].model()}`)
);
