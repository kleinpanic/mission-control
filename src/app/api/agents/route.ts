import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

// Cache for 30 seconds (agent data doesn't change often)
let agentsCache: Record<string, unknown> | null = null;
let agentsCacheTime = 0;
const AGENTS_CACHE_TTL = 30_000;

export async function GET() {
  try {
    const now = Date.now();
    if (agentsCache && (now - agentsCacheTime) < AGENTS_CACHE_TTL) {
      return NextResponse.json(agentsCache);
    }

    // Get config to extract agent definitions
    const configPath = path.join(process.env.HOME || "/home/broklein", ".openclaw/openclaw.json");
    const configRaw = await fs.readFile(configPath, "utf-8");
    const config = JSON.parse(configRaw);
    
    // Get status to extract session/activity data
    const { stdout: rawOutput } = await execAsync(
      'openclaw status --json 2>/dev/null | grep -v "^\\["',
      { maxBuffer: 10 * 1024 * 1024 }
    );
    
    const status = JSON.parse(rawOutput.trim());
    
    // Build agent session map from status.sessions.recent
    const sessionsByAgent: Record<string, Record<string, unknown>[]> = {};
    (status.sessions?.recent || []).forEach((sess: Record<string, unknown>) => {
      const agentId = sess.agentId as string;
      if (!sessionsByAgent[agentId]) {
        sessionsByAgent[agentId] = [];
      }
      sessionsByAgent[agentId].push(sess);
    });
    
    // Build heartbeat config map
    const heartbeatByAgent: Record<string, Record<string, unknown>> = {};
    (status.heartbeat?.agents || []).forEach((hb: Record<string, unknown>) => {
      heartbeatByAgent[hb.agentId as string] = hb;
    });
    
    // Build auth mode map from config.auth.profiles and config.models.providers
    const authProfiles = (config.auth?.profiles || {}) as Record<string, unknown>;
    const modelProviders = (config.models?.providers || {}) as Record<string, unknown>;
    
    // Map provider ID to auth mode using auth profiles
    const providerAuthMode: Record<string, string> = {};
    for (const [_profileKey, profile] of Object.entries(authProfiles)) {
      const p = profile as Record<string, unknown>;
      if (p.provider && p.mode) {
        // Auth profiles use format like "provider: anthropic, mode: token"
        providerAuthMode[p.provider as string] = p.mode as string;
      }
    }
    // Infer from model provider config for providers without explicit auth profiles
    for (const [providerId, providerConfig] of Object.entries(modelProviders)) {
      const pc = providerConfig as Record<string, unknown>;
      if (providerAuthMode[providerId]) continue; // explicit auth profile takes precedence
      const baseUrl = pc.baseUrl as string | undefined;
      if (baseUrl?.includes("localhost") || baseUrl?.includes("127.0.0.1") || baseUrl?.includes("11434")) {
        providerAuthMode[providerId] = "local";
      } else if (pc.apiKey) {
        providerAuthMode[providerId] = "api-key";
      } else {
        // No apiKey and no auth profile — likely inherits from a parent provider's oauth
        // Check if the provider name starts with a known provider that has auth
        const parentProvider = Object.keys(providerAuthMode).find(p => providerId.startsWith(p));
        if (parentProvider) {
          providerAuthMode[providerId] = providerAuthMode[parentProvider];
        }
      }
    }

    const result = {
      defaultId: config.agents?.defaults?.id || "main",
      agents: (config.agents?.list || []).map((agent: any) => {
        const runtimeHb = heartbeatByAgent[agent.id];
        const agentSessions = sessionsByAgent[agent.id] || [];
        const mostRecent = agentSessions[0];
        
        // Resolve model and auth mode
        const modelId = agent.model?.primary || config.agents?.defaults?.model?.primary;
        const providerId = modelId?.split("/")[0];
        const authMode = providerAuthMode[providerId] || "unknown";

        return {
          id: agent.id,
          name: agent.name || agent.id,
          enabled: agent.enabled !== false,
          status: runtimeHb ? (agentSessions.length > 0 ? "active" : "idle") : "idle",
          model: modelId,
          authMode,
          heartbeatInterval: runtimeHb?.every || agent.heartbeat?.every || "—",
          lastActivity: mostRecent?.updatedAt || null,
          sessions: agentSessions.length,
          contextUsage: mostRecent?.percentUsed || 0,
        };
      }),
    };

    agentsCache = result;
    agentsCacheTime = now;

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to fetch agents:", message);
    return NextResponse.json(
      { 
        error: "Failed to fetch agents",
        details: message,
        agents: [],
      },
      { status: 500 }
    );
  }
}
