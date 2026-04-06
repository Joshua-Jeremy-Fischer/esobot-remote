import fs from "fs/promises";
import path from "path";

const RESULTS_FILE = "/data/jobs.json";
const COUNTER_FILE = "/data/search-counter.json";
const INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 Stunden

// Rotation: SearXNG kostenlos (selbst-gehostet) als Standard, paid APIs 1/10 je ~144/Monat
const PROVIDER_ROTATION = [
  "tavily", "serper", "brave",
  "searxng", "searxng", "searxng",
  "searxng", "searxng", "searxng", "searxng"
];

let searchCounter = 0;

async function loadCounter() {
  try {
    const raw = await fs.readFile(COUNTER_FILE, "utf8");
    searchCounter = JSON.parse(raw).count || 0;
  } catch { searchCounter = 0; }
}

async function saveCounter() {
  try { await fs.writeFile(COUNTER_FILE, JSON.stringify({ count: searchCounter }), "utf8"); } catch {}
}

function nextProvider() {
  const provider = PROVIDER_ROTATION[searchCounter % PROVIDER_ROTATION.length];
  searchCounter++;
  saveCounter();
  return provider;
}

const PROFILES = [
  {
    id: "it-security",
    label: "IT Security",
    queries: [
      "Junior SOC Analyst Stellenangebot München Remote 2025 2026",
      "Junior IT Security Analyst Stelle Großraum München Quereinsteiger",
      "ISMS Koordinator Junior Stelle Deutschland Remote",
      "IAM Engineer Junior Stelle München Erding",
    ],
    systemPrompt: `Extrahiere Jobangebote aus den Suchergebnissen. Nur Junior IT-Security Stellen (SOC, ISMS, IAM) im Raum München/Remote. Kein Pflicht-Studium. Format pro Zeile: Jobtitel | Unternehmen | Standort | Remote | URL | Datum. Wenn nichts passt: "Keine passenden Stellen gefunden."`,
  },
  {
    id: "kaufmaennisch",
    label: "Kaufmännisch",
    queries: [
      "Sachbearbeiter Einkauf Vertrieb Stelle Dorfen Erding München 2025 2026",
      "Kaufmännischer Mitarbeiter Innendienst Stelle Mühldorf Rosenheim Landshut",
      "Disponent ERP Stelle München Großraum",
      "Sales Coordinator Junior Account Manager B2B Stelle München",
    ],
    systemPrompt: `Extrahiere Jobangebote aus den Suchergebnissen. Nur kaufmännische Stellen (Sachbearbeiter, Innendienst, Disponent, ERP) im Raum München/Remote. Kein reiner Außendienst. Format pro Zeile: Jobtitel | Unternehmen | Standort | Remote | URL | Datum. Wenn nichts passt: "Keine passenden Stellen gefunden."`,
  },
  {
    id: "it-support-remote",
    label: "IT Support Remote",
    queries: [
      "IT Support Specialist Remote Stelle Deutschland 2025 2026",
      "Junior IT Consultant Remote Stelle Deutschland Quereinsteiger",
      "SaaS Onboarding Specialist Junior Remote Deutschland",
      "Helpdesk IT Service Desk Remote Stelle Deutschland Junior",
    ],
    systemPrompt: `Extrahiere Jobangebote aus den Suchergebnissen. Nur Remote IT-Support Stellen (Helpdesk, IT Support, SaaS Onboarding) deutschlandweit. Kein Pflicht-Studium, kein Vor-Ort-Zwang. Format pro Zeile: Jobtitel | Unternehmen | Standort | Remote | URL | Datum. Wenn nichts passt: "Keine passenden Stellen gefunden."`,
  },
];

let jobStore = { lastRun: null, results: {}, running: false };

async function loadPersistedResults() {
  try {
    const raw = await fs.readFile(RESULTS_FILE, "utf8");
    jobStore = JSON.parse(raw);
  } catch {
    // Noch keine gespeicherten Ergebnisse
  }
}

async function saveResults() {
  try {
    await fs.mkdir(path.dirname(RESULTS_FILE), { recursive: true });
    await fs.writeFile(RESULTS_FILE, JSON.stringify(jobStore, null, 2), "utf8");
  } catch (e) {
    console.error("[JOB-CRAWLER] Speichern fehlgeschlagen:", e.message);
  }
}

async function runSearch(profile, webSearch, makeLLMClient) {
  const provider = nextProvider();
  console.log(`[JOB-CRAWLER] Starte Suche: ${profile.label} via ${provider}`);
  const allSnippets = [];

  for (const query of profile.queries) {
    try {
      const result = await webSearch(query, provider);
      if (result.results?.length) {
        for (const r of result.results) {
          allSnippets.push(`Titel: ${r.title}\nURL: ${r.url}\nBeschreibung: ${r.snippet || ""}`);
        }
      }
    } catch (e) {
      console.error(`[JOB-CRAWLER] Suche fehlgeschlagen (${query}):`, e.message);
    }
  }

  if (allSnippets.length === 0) {
    return "Keine Suchergebnisse gefunden.";
  }

  // Direkt rohe Ergebnisse zurückgeben — kein LLM-Schritt (zu unzuverlässig)
  console.log(`[JOB-CRAWLER] ${profile.label}: ${allSnippets.length} Ergebnisse gefunden`);
  return allSnippets.slice(0, 10).join("\n---\n");
}

export async function crawlJobs(webSearch, makeLLMClient) {
  if (jobStore.running) {
    console.log("[JOB-CRAWLER] Läuft bereits, überspringe.");
    return;
  }
  jobStore.running = true;
  jobStore.lastRun = new Date().toISOString();

  for (const profile of PROFILES) {
    jobStore.results[profile.id] = {
      label: profile.label,
      updatedAt: new Date().toISOString(),
      status: "running",
      content: "",
    };
  }

  for (const profile of PROFILES) {
    const content = await runSearch(profile, webSearch, makeLLMClient);
    jobStore.results[profile.id] = {
      label: profile.label,
      updatedAt: new Date().toISOString(),
      status: "done",
      content,
    };
  }

  jobStore.running = false;
  await saveResults();
  console.log(`[JOB-CRAWLER] Durchlauf abgeschlossen: ${jobStore.lastRun}`);

  // Ergebnisse ins Postfach schreiben
  try {
    const { addPostfachEntry } = await import("./agent.js");
    const profiles = Object.values(jobStore.results).filter(p => p.content);
    for (const p of profiles) {
      const lines = (p.content || "").split("\n").filter(l => l.trim() && !l.includes("Keine") );
      const count = lines.length;
      const title = `💼 ${p.label}: ${count > 0 ? `${count} Stelle${count !== 1 ? "n" : ""} gefunden` : "Keine Ergebnisse"}`;
      await addPostfachEntry(title, p.content, "jobs");
    }
  } catch (e) {
    console.warn("[JOB-CRAWLER] Postfach-Write fehlgeschlagen:", e.message);
  }
}

export async function startJobCrawler(webSearch, makeLLMClient) {
  await loadPersistedResults();
  await loadCounter();
  console.log("[JOB-CRAWLER] Gestartet — läuft alle 6 Stunden.");

  // Sofort einmal laufen lassen
  crawlJobs(webSearch, makeLLMClient);

  setInterval(() => {
    crawlJobs(webSearch, makeLLMClient);
  }, INTERVAL_MS);
}

export function getJobResults() {
  return jobStore;
}
