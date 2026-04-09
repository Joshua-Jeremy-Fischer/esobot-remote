/**
 * ESO Bot — Cron-Parse-Utilities
 * Portiert aus OpenClaw (src/cron/parse.ts + src/cli/parse-duration.ts)
 *
 * parseAbsoluteTimeMs(input) — ISO-String → Unix-ms
 * parseDurationMs(raw)       — "5m", "1h30m", "30s", "2d" → ms
 */

// ── parseAbsoluteTimeMs ───────────────────────────────────────
// Port von OpenClaw src/cron/parse.ts

const ISO_TZ_RE = /(Z|[+-]\d{2}:?\d{2})$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T/;

function normalizeUtcIso(raw) {
  if (ISO_TZ_RE.test(raw))      return raw;
  if (ISO_DATE_RE.test(raw))    return `${raw}T00:00:00Z`;
  if (ISO_DATE_TIME_RE.test(raw)) return `${raw}Z`;
  return raw;
}

/**
 * Parst einen ISO-String (oder rohen ms-Epoch-String) zu Unix-ms.
 * Gibt null zurück wenn der Input nicht parsebar ist.
 * Port von OpenClaw src/cron/parse.ts → parseAbsoluteTimeMs
 */
export function parseAbsoluteTimeMs(input) {
  if (input == null) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  // Bare integer → bereits ms-Epoch
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }

  const parsed = Date.parse(normalizeUtcIso(raw));
  return Number.isFinite(parsed) ? parsed : null;
}

// ── parseDurationMs ───────────────────────────────────────────
// Port von OpenClaw src/cli/parse-duration.ts

const DURATION_MULTIPLIERS = {
  ms: 1,
  s:  1_000,
  m:  60_000,
  h:  3_600_000,
  d:  86_400_000,
};

// Regex: eine "Token"-Einheit wie "5m", "1h", "30s", "500ms"
const TOKEN_RE = /(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)/gi;

/**
 * Parst Human-Readable-Durations zu Millisekunden.
 *
 * Unterstützte Formate:
 *   "5m"       → 300000
 *   "1h30m"    → 5400000
 *   "2h"       → 7200000
 *   "30s"      → 30000
 *   "500ms"    → 500
 *   "1d"       → 86400000
 *   "1h30m20s" → 5420000
 *   "45"       → 45  (bare number → ms)
 *
 * Gibt null zurück wenn nichts erkannt wurde.
 * Port von OpenClaw src/cli/parse-duration.ts → parseDurationMs
 */
export function parseDurationMs(raw) {
  if (raw == null) return null;
  const str = String(raw).trim();
  if (!str) return null;

  // Bare integer ohne Einheit → ms
  if (/^\d+$/.test(str)) {
    const n = Number(str);
    return Number.isFinite(n) ? n : null;
  }

  let total = 0;
  let matched = 0;

  TOKEN_RE.lastIndex = 0;
  let m;
  while ((m = TOKEN_RE.exec(str)) !== null) {
    const value = parseFloat(m[1]);
    const unit  = m[2].toLowerCase();
    const mult  = DURATION_MULTIPLIERS[unit];
    if (!mult || !Number.isFinite(value) || value < 0) return null;
    total   += value * mult;
    matched += m[0].length;
  }

  // Nichts erkannt oder nur ein Teil des Strings passte
  if (matched === 0) return null;

  // Prüfe ob der gesamte String aus gültigen Tokens besteht
  // (verhindert "5m garbage" als valide Duration)
  const stripped = str.replace(/\s+/g, "").replace(TOKEN_RE, "").trim();
  if (stripped.length > 0) return null;

  return Math.floor(total);
}
