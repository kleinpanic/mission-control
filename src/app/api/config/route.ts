// Mission Control - Config API
// Reads config directly from disk (avoids WS operator.read scope)
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

// Cache for 30s
let configCache: Record<string, unknown> | null = null;
let configCacheTime = 0;
const CACHE_TTL = 30_000;

export async function GET() {
  try {
    const now = Date.now();
    if (configCache && now - configCacheTime < CACHE_TTL) {
      return NextResponse.json(configCache);
    }

    const configPath = path.join(
      process.env.HOME || "/home/broklein",
      ".openclaw/openclaw.json"
    );
    const raw = await fs.readFile(configPath, "utf-8");
    const config = JSON.parse(raw);

    // Extract safe-to-expose config (no secrets)
    const defaultModel =
      config.agents?.defaults?.model?.primary || "anthropic/claude-sonnet-4-5";
    const contextTokens = config.session?.contextTokens || 200000;

    // Build agent list from config
    const agents = (config.agents?.list || []).map((a: Record<string, any>) => ({
      id: a.id,
      model: a.model?.primary || defaultModel,
      heartbeat: a.heartbeat,
      enabled: a.enabled !== false,
    }));

    // Build model list from providers
    const availableModels: { value: string; label: string }[] = [
      { value: "default", label: `Default (${defaultModel})` },
    ];
    const seenModels = new Set<string>();
    const providers = config.models?.providers || {};
    for (const [providerId, pc] of Object.entries(providers) as [string, Record<string, any>][]) {
      for (const model of pc?.models || []) {
        const fullId = `${providerId}/${model.id}`;
        if (!seenModels.has(fullId)) {
          seenModels.add(fullId);
          availableModels.push({
            value: fullId,
            label: model.name || fullId,
          });
        }
      }
    }

    // Also include alias models from defaults
    const defaultModels = config.agents?.defaults?.models || {};
    for (const [modelId, mc] of Object.entries(defaultModels) as [string, Record<string, any>][]) {
      if (!seenModels.has(modelId)) {
        seenModels.add(modelId);
        availableModels.push({
          value: modelId,
          label: mc?.alias ? `${modelId} (${mc.alias})` : modelId,
        });
      }
    }

    const result = {
      defaultModel,
      contextTokens,
      agents,
      availableModels,
    };

    configCache = result;
    configCacheTime = now;

    return NextResponse.json(result);
  } catch (error) {
    console.error("Config API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
