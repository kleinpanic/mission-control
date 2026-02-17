// Mission Control - Agents API
// Provides agent data via OpenClaw CLI (bypasses WebSocket pairing requirement)
import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

// Cache for 30 seconds (agent data doesn't change often)
let agentsCache: unknown = null;
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
    
    // Combine agent config with runtime data
    const agentList = config.agents?.list || [];
    const agents = agentList.map((agent: Record<string, unknown>) => {
      const agentId = (agent.id as string) || "unknown";
      const sessions = sessionsByAgent[agentId] || [];
      const heartbeat = heartbeatByAgent[agentId];
      
      // Get most recent session for last activity
      const mostRecent = sessions.length > 0 
        ? sessions.reduce((a, b) => (a.updatedAt as number) > (b.updatedAt as number) ? a : b)
        : null;
      
      // Calculate status based on sessions and heartbeat
      let status = "idle";
      if (sessions.some((s: Record<string, unknown>) => s.abortedLastRun)) {
        status = "error";
      } else if (sessions.some((s: Record<string, unknown>) => s.systemSent && (s.ageMs as number) < 300000)) {
        status = "active";
      }
      
      // Determine model string and provider
      const agentModel = agent.model as string | { primary?: string; fallbacks?: string[] } | undefined;
      const modelStr = typeof agentModel === "string" ? agentModel : (agentModel?.primary || "default");
      const providerId = modelStr.includes("/") ? modelStr.split("/")[0] : "default";
      const authMode = providerAuthMode[providerId] || "unknown";
      
      // Get fallback models with their auth modes
      const fallbacks = (typeof agentModel === "object" && agentModel?.fallbacks) 
        ? (agentModel.fallbacks as string[]).map((fb: string) => {
            const fbProvider = fb.includes("/") ? fb.split("/")[0] : "default";
            return { model: fb, authMode: providerAuthMode[fbProvider] || "unknown" };
          })
        : [];
      
      return {
        id: agentId,
        name: (agent.name as string) || agentId,
        enabled: agent.enabled !== false,
        status,
        model: modelStr,
        authMode, // "oauth" | "api" | "token" | "local" | "unknown"
        fallbacks,
        sessions: sessions.length,
        heartbeatInterval: heartbeat?.every || "unknown",
        lastActivity: mostRecent ? new Date(mostRecent.updatedAt as number).toISOString() : null,
        contextUsage: (mostRecent?.percentUsed as number) || 0,
        totalTokens: sessions.reduce((sum: number, s: Record<string, unknown>) => sum + ((s.totalTokens as number) || 0), 0),
      };
    });
    
    const result = {
      agents,
      timestamp: new Date().toISOString(),
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
