// Mission Control - Agents API
// Provides agent data via OpenClaw CLI (bypasses WebSocket pairing requirement)
import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

// Cache for 5 seconds
let agentsCache: any = null;
let agentsCacheTime = 0;
const AGENTS_CACHE_TTL = 5000;

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
    const sessionsByAgent: Record<string, any[]> = {};
    (status.sessions?.recent || []).forEach((sess: any) => {
      const agentId = sess.agentId;
      if (!sessionsByAgent[agentId]) {
        sessionsByAgent[agentId] = [];
      }
      sessionsByAgent[agentId].push(sess);
    });
    
    // Build heartbeat config map
    const heartbeatByAgent: Record<string, any> = {};
    (status.heartbeat?.agents || []).forEach((hb: any) => {
      heartbeatByAgent[hb.agentId] = hb;
    });
    
    // Build auth mode map from config.auth.profiles and config.models.providers
    const authProfiles = config.auth?.profiles || {};
    const modelProviders = config.models?.providers || {};
    
    // Map provider prefix to auth mode
    const providerAuthMode: Record<string, string> = {};
    for (const [_profileKey, profile] of Object.entries(authProfiles)) {
      const p = profile as any;
      if (p.provider) {
        providerAuthMode[p.provider] = p.mode || "unknown";
      }
    }
    // Infer from model provider config (apiKey = api, baseUrl with localhost = local)
    for (const [providerId, providerConfig] of Object.entries(modelProviders)) {
      const pc = providerConfig as any;
      if (providerAuthMode[providerId]) continue; // auth profile takes precedence
      if (pc.baseUrl?.includes("localhost") || pc.baseUrl?.includes("127.0.0.1")) {
        providerAuthMode[providerId] = "local";
      } else if (pc.apiKey) {
        providerAuthMode[providerId] = "api";
      }
    }
    
    // Combine agent config with runtime data
    const agentList = config.agents?.list || [];
    const agents = agentList.map((agent: any) => {
      const sessions = sessionsByAgent[agent.id] || [];
      const heartbeat = heartbeatByAgent[agent.id];
      
      // Get most recent session for last activity
      const mostRecent = sessions.length > 0 
        ? sessions.reduce((a, b) => a.updatedAt > b.updatedAt ? a : b)
        : null;
      
      // Calculate status based on sessions and heartbeat
      let status = "idle";
      if (sessions.some((s: any) => s.abortedLastRun)) {
        status = "error";
      } else if (sessions.some((s: any) => s.systemSent && s.ageMs < 300000)) {
        status = "active";
      }
      
      // Determine model string and provider
      const modelStr = typeof agent.model === "string" ? agent.model : (agent.model?.primary || "default");
      const providerId = modelStr.includes("/") ? modelStr.split("/")[0] : "default";
      const authMode = providerAuthMode[providerId] || "unknown";
      
      // Get fallback models with their auth modes
      const fallbacks = (typeof agent.model === "object" && agent.model?.fallbacks) 
        ? (agent.model.fallbacks as string[]).map((fb: string) => {
            const fbProvider = fb.includes("/") ? fb.split("/")[0] : "default";
            return { model: fb, authMode: providerAuthMode[fbProvider] || "unknown" };
          })
        : [];
      
      return {
        id: agent.id,
        name: agent.name || agent.id,
        enabled: agent.enabled !== false,
        status,
        model: modelStr,
        authMode, // "oauth" | "api" | "token" | "local" | "unknown"
        fallbacks,
        sessions: sessions.length,
        heartbeatInterval: heartbeat?.every || "unknown",
        lastActivity: mostRecent ? new Date(mostRecent.updatedAt).toISOString() : null,
        contextUsage: mostRecent?.percentUsed || 0,
        totalTokens: sessions.reduce((sum: number, s: any) => sum + (s.totalTokens || 0), 0),
      };
    });
    
    const result = {
      agents,
      timestamp: new Date().toISOString(),
    };
    
    agentsCache = result;
    agentsCacheTime = now;
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Failed to fetch agents:", error.message);
    return NextResponse.json(
      { 
        error: "Failed to fetch agents",
        details: error.message,
        agents: [],
      },
      { status: 500 }
    );
  }
}
