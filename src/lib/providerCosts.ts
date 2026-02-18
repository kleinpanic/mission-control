/**
 * Provider & Model Cost Configuration
 * =====================================
 * All costs are per-unit (per-token, per-character, per-query, per-SMS, per-minute).
 * NO flat subscriptions. Every cost is tracked by actual usage.
 *
 * Users can extend by adding entries to MODEL_PRICING and PROVIDER_CONFIGS.
 *
 * Token pricing is per 1 million tokens unless otherwise noted.
 * Character pricing is per 1 million characters.
 * Query pricing is per 1,000 queries.
 * SMS/voice pricing is per unit.
 */

// ──────────────────────────────────────────────
// Provider definitions (color, icon, unit type)
// ──────────────────────────────────────────────
export interface ProviderConfig {
  id: string;
  name: string;
  color: string;         // hex for charts
  icon: string;          // emoji
  unitType: "token" | "character" | "query" | "message" | "minute" | "mixed";
  trackingMethod: "codexbar" | "session-tokens" | "api-logs" | "manual";
  description: string;
}

export const PROVIDER_CONFIGS: ProviderConfig[] = [
  {
    id: "claude",
    name: "Anthropic",
    color: "#ef4444",
    icon: "🔴",
    unitType: "token",
    trackingMethod: "codexbar",
    description: "Claude models — Opus, Sonnet, Haiku",
  },
  {
    id: "codex",
    name: "OpenAI",
    color: "#22c55e",
    icon: "🟢",
    unitType: "token",
    trackingMethod: "codexbar",
    description: "GPT and Codex models",
  },
  {
    id: "google",
    name: "Google",
    color: "#3b82f6",
    icon: "🔵",
    unitType: "token",
    trackingMethod: "session-tokens",
    description: "Gemini API models — Pro, Flash, Flash-Lite",
  },
  {
    id: "xai",
    name: "xAI",
    color: "#eab308",
    icon: "🟡",
    unitType: "token",
    trackingMethod: "session-tokens",
    description: "Grok models",
  },
  {
    id: "perplexity",
    name: "Perplexity",
    color: "#06b6d4",
    icon: "🔷",
    unitType: "mixed", // per-request + per-token
    trackingMethod: "api-logs",
    description: "Sonar search API — per-request + per-token",
  },
  {
    id: "brave",
    name: "Brave",
    color: "#f97316",
    icon: "🟠",
    unitType: "query",
    trackingMethod: "api-logs",
    description: "Brave Search API — per-query pricing",
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    color: "#8b5cf6",
    icon: "🟣",
    unitType: "character",
    trackingMethod: "api-logs",
    description: "Text-to-speech — per-character pricing",
  },
  {
    id: "twilio",
    name: "Twilio",
    color: "#ec4899",
    icon: "💗",
    unitType: "mixed", // per-SMS + per-minute
    trackingMethod: "api-logs",
    description: "Voice calls and SMS — per-unit pricing",
  },
];

// ──────────────────────────────────────────────
// Per-model token pricing (per 1M tokens)
// ──────────────────────────────────────────────
export interface ModelPricing {
  model: string;           // model name pattern
  provider: string;        // provider id
  inputPer1M: number;      // $ per 1M input tokens
  outputPer1M: number;     // $ per 1M output tokens
  cacheReadPer1M?: number; // $ per 1M cached input tokens (if applicable)
  cacheWritePer1M?: number; // $ per 1M cache creation tokens
  batchDiscount?: number;  // multiplier for batch (e.g. 0.5 = 50% off)
}

export const MODEL_PRICING: ModelPricing[] = [
  // ── Anthropic / Claude ──
  { model: "claude-opus-4-6",       provider: "claude",  inputPer1M: 5.00,  outputPer1M: 25.00, cacheReadPer1M: 0.50, cacheWritePer1M: 6.25, batchDiscount: 0.5 },
  { model: "claude-opus-4-5",       provider: "claude",  inputPer1M: 5.00,  outputPer1M: 25.00, cacheReadPer1M: 0.50, cacheWritePer1M: 6.25, batchDiscount: 0.5 },
  { model: "claude-sonnet-4-5",     provider: "claude",  inputPer1M: 3.00,  outputPer1M: 15.00, cacheReadPer1M: 0.30, cacheWritePer1M: 3.75, batchDiscount: 0.5 },
  { model: "claude-sonnet-4",       provider: "claude",  inputPer1M: 3.00,  outputPer1M: 15.00, cacheReadPer1M: 0.30, cacheWritePer1M: 3.75, batchDiscount: 0.5 },
  { model: "claude-haiku-4-5",      provider: "claude",  inputPer1M: 1.00,  outputPer1M: 5.00,  cacheReadPer1M: 0.10, cacheWritePer1M: 1.25, batchDiscount: 0.5 },
  { model: "claude-haiku-3-5",      provider: "claude",  inputPer1M: 0.80,  outputPer1M: 4.00,  cacheReadPer1M: 0.08, cacheWritePer1M: 1.00, batchDiscount: 0.5 },

  // ── OpenAI / GPT / Codex ──
  { model: "gpt-5.2",               provider: "codex",   inputPer1M: 1.25,  outputPer1M: 10.00 },
  { model: "gpt-5.3-codex",         provider: "codex",   inputPer1M: 1.25,  outputPer1M: 10.00 },
  { model: "gpt-5-mini",            provider: "codex",   inputPer1M: 0.25,  outputPer1M: 1.25  },
  { model: "gpt-5",                 provider: "codex",   inputPer1M: 1.25,  outputPer1M: 10.00 },
  { model: "o4-mini",               provider: "codex",   inputPer1M: 1.10,  outputPer1M: 4.40  },
  { model: "o3",                    provider: "codex",   inputPer1M: 2.00,  outputPer1M: 8.00  },

  // ── Google / Gemini (API pricing, NOT subscription) ──
  { model: "gemini-3-pro",          provider: "google",  inputPer1M: 2.00,  outputPer1M: 12.00 },
  { model: "gemini-3-flash",        provider: "google",  inputPer1M: 0.50,  outputPer1M: 3.00  },
  { model: "gemini-2.5-pro",        provider: "google",  inputPer1M: 1.25,  outputPer1M: 10.00 },
  { model: "gemini-2.5-flash",      provider: "google",  inputPer1M: 0.15,  outputPer1M: 0.60  },
  { model: "gemini-flash-lite",     provider: "google",  inputPer1M: 0.10,  outputPer1M: 0.40  },

  // ── xAI / Grok ──
  { model: "grok-4",                provider: "xai",     inputPer1M: 3.00,  outputPer1M: 15.00 },
  { model: "grok-4.1-fast",         provider: "xai",     inputPer1M: 0.20,  outputPer1M: 0.50  },
  { model: "grok-3",                provider: "xai",     inputPer1M: 3.00,  outputPer1M: 15.00 },

  // ── Perplexity / Sonar ──
  { model: "sonar",                 provider: "perplexity", inputPer1M: 1.00,  outputPer1M: 1.00  },
  { model: "sonar-pro",             provider: "perplexity", inputPer1M: 3.00,  outputPer1M: 15.00 },
];

// ──────────────────────────────────────────────
// Non-token pricing (per-query, per-char, etc.)
// ──────────────────────────────────────────────
export interface UnitPricing {
  provider: string;
  service: string;
  costPerUnit: number;
  unitLabel: string;       // "query", "character", "SMS", "minute"
  unitScale: number;       // e.g. 1000 for "per 1000 queries"
  notes?: string;
}

export const UNIT_PRICING: UnitPricing[] = [
  // Brave Search
  { provider: "brave",      service: "Web Search",   costPerUnit: 5.00,  unitLabel: "queries",    unitScale: 1000, notes: "$5 free credit/mo with attribution" },
  { provider: "brave",      service: "Spellcheck",   costPerUnit: 5.00,  unitLabel: "requests",   unitScale: 10000 },

  // Perplexity (per-request fee ON TOP of per-token)
  { provider: "perplexity", service: "Sonar Search",     costPerUnit: 5.00, unitLabel: "searches", unitScale: 1000 },
  { provider: "perplexity", service: "Sonar Pro Search",  costPerUnit: 5.00, unitLabel: "searches", unitScale: 1000 },

  // ElevenLabs (per-character)
  { provider: "elevenlabs", service: "TTS Standard",   costPerUnit: 180.00, unitLabel: "characters", unitScale: 1000000, notes: "$0.18 per 1K characters" },
  { provider: "elevenlabs", service: "TTS Flash/Turbo", costPerUnit: 90.00,  unitLabel: "characters", unitScale: 1000000, notes: "0.5x credit rate for Flash models" },

  // Twilio
  { provider: "twilio",     service: "SMS (US)",       costPerUnit: 0.0079, unitLabel: "SMS",     unitScale: 1 },
  { provider: "twilio",     service: "MMS (US)",       costPerUnit: 0.0100, unitLabel: "MMS",     unitScale: 1 },
  { provider: "twilio",     service: "Voice (US)",     costPerUnit: 0.014,  unitLabel: "minutes", unitScale: 1, notes: "Per minute, outbound US" },
];

// ──────────────────────────────────────────────
// Helper functions
// ──────────────────────────────────────────────

/** Get provider config by id */
export function getProviderConfig(id: string): ProviderConfig | undefined {
  return PROVIDER_CONFIGS.find(p => p.id === id);
}

/** Get provider color by id */
export function getProviderColor(id: string): string {
  return getProviderConfig(id)?.color || "#71717a";
}

/** Get all providers */
export function getAllProviders(): ProviderConfig[] {
  return PROVIDER_CONFIGS;
}

/** Find the best matching model pricing entry */
export function findModelPricing(modelName: string): ModelPricing | undefined {
  const m = modelName.toLowerCase();
  // Try exact match first
  let match = MODEL_PRICING.find(p => m === p.model.toLowerCase());
  if (match) return match;
  // Try startsWith match (handles version suffixes like claude-haiku-4-5-20251001)
  match = MODEL_PRICING.find(p => m.startsWith(p.model.toLowerCase()));
  if (match) return match;
  // Try contains match
  match = MODEL_PRICING.find(p => m.includes(p.model.toLowerCase()));
  return match;
}

/** Calculate cost from token counts for a specific model */
export function calculateTokenCost(
  modelName: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens?: number,
  cacheWriteTokens?: number,
): { cost: number; provider: string; pricing: ModelPricing | null } {
  const pricing = findModelPricing(modelName);
  if (!pricing) {
    return { cost: 0, provider: identifyProvider(modelName), pricing: null };
  }

  let cost = 0;
  cost += (inputTokens / 1_000_000) * pricing.inputPer1M;
  cost += (outputTokens / 1_000_000) * pricing.outputPer1M;
  if (cacheReadTokens && pricing.cacheReadPer1M) {
    cost += (cacheReadTokens / 1_000_000) * pricing.cacheReadPer1M;
  }
  if (cacheWriteTokens && pricing.cacheWritePer1M) {
    cost += (cacheWriteTokens / 1_000_000) * pricing.cacheWritePer1M;
  }

  return { cost, provider: pricing.provider, pricing };
}

/** Calculate cost for non-token units */
export function calculateUnitCost(
  provider: string,
  service: string,
  units: number,
): number {
  const pricing = UNIT_PRICING.find(
    p => p.provider === provider && p.service === service
  );
  if (!pricing) return 0;
  return (units / pricing.unitScale) * pricing.costPerUnit;
}

/** Identify provider from model string */
export function identifyProvider(model: string): string {
  const m = model.toLowerCase();
  if (m.includes("claude") || m.includes("anthropic") || m.includes("sonnet") || m.includes("opus") || m.includes("haiku")) return "claude";
  if (m.includes("gpt") || m.includes("openai") || m.includes("codex") || m.includes("o1-") || m.includes("o3") || m.includes("o4-")) return "codex";
  if (m.includes("gemini") || m.includes("google")) return "google";
  if (m.includes("grok") || m.includes("xai")) return "xai";
  if (m.includes("sonar") || m.includes("perplexity")) return "perplexity";
  return "unknown";
}

/** Get pricing summary for a model (for tooltips/display) */
export function getModelPricingSummary(modelName: string): string {
  const pricing = findModelPricing(modelName);
  if (!pricing) return "Pricing unknown";
  let s = `$${pricing.inputPer1M}/$${pricing.outputPer1M} per 1M tokens (in/out)`;
  if (pricing.cacheReadPer1M) {
    s += ` • Cache read: $${pricing.cacheReadPer1M}/1M`;
  }
  return s;
}
