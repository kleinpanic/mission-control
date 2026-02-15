// Mission Control - Agents API
// Provides agent data via OpenClaw CLI (bypasses WebSocket pairing requirement)
import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

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

    // Get agents list from OpenClaw CLI
    const { stdout: statusJson } = await execAsync(
      'openclaw status --json 2>/dev/null | grep -v "^\\[" | head -500'
    );
    
    const status = JSON.parse(statusJson.trim());
    
    // Extract agents data
    const agents = status.agents || [];
    
    const result = {
      agents: agents.map((agent: any) => ({
        id: agent.id,
        name: agent.name || agent.id,
        enabled: agent.enabled !== false,
        status: agent.status || "unknown",
        model: agent.model || null,
        sessions: agent.sessions || 0,
        heartbeatInterval: agent.heartbeatInterval || "unknown",
        lastActivity: agent.lastActivity || null,
      })),
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
