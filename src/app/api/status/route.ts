import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface AgentInfo {
  id: string;
  name: string;
  enabled: boolean;
  status: "active" | "idle" | "waiting" | "error";
  model: string | null;
  heartbeatInterval: string;
  heartbeatIntervalMs: number;
  lastActivity: string | null;
  lastActivityAge: string;
  activeSessions: number;
  totalTokensUsed: number;
  maxSessionPercent: number;
}

interface SessionInfo {
  agentId: string;
  key: string;
  kind: string;
  model: string;
  percentUsed: number;
  totalTokens: number;
  remainingTokens: number;
  contextTokens: number;
  updatedAt: number;
  age: number;
}

interface StatusResponse {
  gateway: {
    status: "connected" | "disconnected" | "unknown";
    version?: string;
    url: string;
  };
  agents: AgentInfo[];
  sessions: {
    total: number;
    atCapacity: number;
    recent: SessionInfo[];
  };
  heartbeat: {
    defaultAgentId: string;
    nextHeartbeats: { agentId: string; nextIn: string; nextInMs: number }[];
  };
  channels: string[];
}

function formatAge(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)}s ago`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.round(ms / 3600000)}h ago`;
  return `${Math.round(ms / 86400000)}d ago`;
}

function formatDuration(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${Math.round(ms / 3600000)}h`;
}

// Cache for 10 seconds to improve performance
let statusCache: StatusResponse | null = null;
let statusCacheTime = 0;
const STATUS_CACHE_TTL = 10000;

export async function GET() {
  try {
    const now = Date.now();
    if (statusCache && (now - statusCacheTime) < STATUS_CACHE_TTL) {
      return NextResponse.json(statusCache);
    }

    // Get OpenClaw status via gateway HTTP API (faster + more reliable than CLI)
    // Falls back to CLI if HTTP fails
    let statusData: Record<string, unknown> = {};
    
    const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789';
    const httpUrl = gatewayUrl.replace('ws://', 'http://').replace('wss://', 'https://');
    const token = process.env.OPENCLAW_GATEWAY_TOKEN || '';
    
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const res = await fetch(`${httpUrl}/api/v1/invoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ method: 'status' }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const result = await res.json() as { result?: Record<string, unknown> };
      statusData = result.result || (result as unknown as Record<string, unknown>) || {};
    } catch {
      // HTTP API failed (expected — gateway doesn't have this endpoint), fallback to CLI
      try {
        const { stdout: statusJson } = await execAsync(
          'openclaw status --json 2>/dev/null',
          { 
            maxBuffer: 10 * 1024 * 1024, 
            timeout: 5000,
            env: {
              ...process.env,
              PATH: `/home/broklein/.local/bin:${process.env.PATH || '/usr/local/bin:/usr/bin:/bin'}`,
              HOME: process.env.HOME || '/home/broklein',
            }
          }
        );
        
        // Extract JSON object from output (skip any non-JSON lines from plugin logs)
        const lines = statusJson.split('\n');
        const jsonStart = lines.findIndex(line => line.trim().startsWith('{'));
        if (jsonStart !== -1) {
          const jsonText = lines.slice(jsonStart).join('\n');
          statusData = JSON.parse(jsonText) as Record<string, unknown>;
        }
      } catch (cliError: unknown) {
        const msg = cliError instanceof Error ? cliError.message : String(cliError);
        console.error("[status] CLI fallback failed:", msg);
      }
    }

    // Build agents info
    const statusHeartbeat = statusData.heartbeat as { agents?: any[], defaultAgentId?: string } | undefined;
    const heartbeatAgents = (statusHeartbeat?.agents || []) as any[];
    const statusSessions = statusData.sessions as { recent?: any[], count?: number } | undefined;
    const recentSessions = (statusSessions?.recent || []) as any[];

    // Group sessions by agent
    const sessionsByAgent: Record<string, any[]> = {};
    for (const session of recentSessions) {
      const agentId = session.agentId as string;
      if (!sessionsByAgent[agentId]) {
        sessionsByAgent[agentId] = [];
      }
      sessionsByAgent[agentId].push(session);
    }

    // Build agent info
    const agents: AgentInfo[] = heartbeatAgents.map((hb) => {
      const agentSessions = sessionsByAgent[hb.agentId] || [];
      const mostRecentSession = agentSessions[0];

      // Determine status based on session activity
      let status: AgentInfo["status"] = "idle";
      let lastActivityMs = 0;

      if (mostRecentSession) {
        lastActivityMs = mostRecentSession.age || 0;
        if (lastActivityMs < 300000) {
          // Active in last 5 minutes
          status = "active";
        } else if (mostRecentSession.percentUsed >= 95) {
          status = "waiting";
        }
      }

      const maxPercent = Math.max(0, ...agentSessions.map((s: any) => s.percentUsed || 0));

      return {
        id: hb.agentId,
        name: hb.agentId.charAt(0).toUpperCase() + hb.agentId.slice(1),
        enabled: hb.enabled,
        status,
        model: mostRecentSession?.model || null,
        heartbeatInterval: hb.every,
        heartbeatIntervalMs: hb.everyMs,
        lastActivity: mostRecentSession
          ? new Date(now - (mostRecentSession.age || 0)).toISOString()
          : null,
        lastActivityAge: mostRecentSession ? formatAge(mostRecentSession.age || 0) : "never",
        activeSessions: agentSessions.length,
        totalTokensUsed: agentSessions.reduce(
          (sum: number, s: any) => sum + (s.totalTokens || 0),
          0
        ),
        maxSessionPercent: maxPercent,
      };
    });

    // Calculate next heartbeats
    const nextHeartbeats = heartbeatAgents
      .filter((hb) => hb.enabled)
      .map((hb) => {
        // Estimate next heartbeat based on interval
        // This is approximate - would need to track actual last heartbeat time
        const intervalMs = hb.everyMs;
        const agentSessions = sessionsByAgent[hb.agentId] || [];
        const lastActivity = agentSessions[0]?.age || intervalMs;
        const nextInMs = Math.max(0, intervalMs - (lastActivity % intervalMs));

        return {
          agentId: hb.agentId,
          nextIn: formatDuration(nextInMs),
          nextInMs,
        };
      })
      .sort((a, b) => a.nextInMs - b.nextInMs);

    // Sessions summary
    const atCapacity = recentSessions.filter((s) => (s.percentUsed || 0) >= 95).length;

    const response: StatusResponse = {
      gateway: {
        status: "connected",
        url: "ws://127.0.0.1:18789",
      },
      agents,
      sessions: {
        total: statusSessions?.count || 0,
        atCapacity,
        recent: recentSessions.slice(0, 10).map((s) => ({
          agentId: s.agentId,
          key: s.key,
          kind: s.kind,
          model: s.model,
          percentUsed: s.percentUsed,
          totalTokens: s.totalTokens,
          remainingTokens: s.remainingTokens,
          contextTokens: s.contextTokens,
          updatedAt: s.updatedAt,
          age: s.age,
        })),
      },
      heartbeat: {
        defaultAgentId: statusHeartbeat?.defaultAgentId || "main",
        nextHeartbeats,
      },
      channels: (statusData.channelSummary as string[]) || [],
    };

    // Update cache
    statusCache = response;
    statusCacheTime = now;

    return NextResponse.json(response);
  } catch (error) {
    console.error("GET /api/status error:", error);
    return NextResponse.json(
      {
        gateway: { status: "disconnected", url: "ws://127.0.0.1:18789" },
        agents: [],
        sessions: { total: 0, atCapacity: 0, recent: [] },
        heartbeat: { defaultAgentId: "main", nextHeartbeats: [] },
        channels: [],
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/status
 * Actions: trigger-heartbeat, skip-heartbeat
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, agentId: _agentId } = body;

    if (action === "trigger-heartbeat") {
      // Trigger immediate heartbeat via cron wake
      const { stdout } = await execAsync(
        `openclaw cron wake --mode now --text "Manual heartbeat trigger from Mission Control" 2>&1`
      );
      return NextResponse.json({ success: true, output: stdout.trim() });
    }

    if (action === "skip-heartbeat") {
      // This would need to be implemented in OpenClaw
      return NextResponse.json({
        success: false,
        error: "Skip heartbeat not yet implemented",
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/status error:", error);
    return NextResponse.json({ error: "Failed to execute action" }, { status: 500 });
  }
}
