import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { getOpenClawStatus } from "@/lib/statusCache";

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
    byAgent: any[];
    recent: SessionInfo[];
  };
  heartbeat: {
    defaultAgentId: string;
    nextHeartbeats: { agentId: string; nextIn: string; nextInMs: number; intervalMs?: number }[];
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
let statusCache: any = null;
let statusCacheTime = 0;
const STATUS_CACHE_TTL = 10000;

export async function GET() {
  try {
    const now = Date.now();
    if (statusCache && (now - statusCacheTime) < STATUS_CACHE_TTL) {
      return NextResponse.json(statusCache);
    }

    // Get OpenClaw status via shared cache (deduped CLI call)
    let statusData: any = {};
    try {
      statusData = await getOpenClawStatus();
    } catch (cliError: any) {
      console.error("[status] Failed to get OpenClaw status:", cliError.message);
    }

    // Build agents info
    const heartbeatAgents = statusData.heartbeat?.agents || [];
    const recentSessions = statusData.sessions?.recent || [];

    // Use byAgent for accurate session counts, recent for activity data
    const byAgentMap: Record<string, { count: number; recent: any[] }> = {};
    for (const entry of (statusData.sessions?.byAgent || [])) {
      byAgentMap[entry.agentId] = { count: entry.count || 0, recent: entry.recent || [] };
    }

    // Group recent sessions by agent (for activity data)
    const sessionsByAgent: Record<string, SessionInfo[]> = {};
    for (const session of recentSessions) {
      const agentId = session.agentId;
      if (!sessionsByAgent[agentId]) {
        sessionsByAgent[agentId] = [];
      }
      sessionsByAgent[agentId].push(session);
    }

    // Build agent info
    const agents: AgentInfo[] = heartbeatAgents.map((hb: any) => {
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
        activeSessions: byAgentMap[hb.agentId]?.count || agentSessions.length,
        totalTokensUsed: agentSessions.reduce(
          (sum: number, s: any) => sum + (s.totalTokens || 0),
          0
        ),
        maxSessionPercent: maxPercent,
      };
    });

    // Calculate next heartbeats using cron data for accurate timing
    let cronJobs: any[] = [];
    try {
      const cronResp = await fetch(`http://127.0.0.1:${process.env.MISSION_CONTROL_PORT || 3333}/api/cron`, {
        signal: AbortSignal.timeout(3000),
      }).then(r => r.ok ? r.json() : null).catch(() => null);
      cronJobs = cronResp?.jobs || [];
    } catch { /* ignore */ }

    const nextHeartbeats = heartbeatAgents
      .filter((hb: any) => hb.enabled && hb.everyMs > 0)
      .map((hb: any) => {
        const intervalMs = hb.everyMs;
        // Check cron for accurate next-run time
        const cronJob = cronJobs.find((j: any) => 
          j.name?.toLowerCase().includes(hb.agentId) && 
          j.name?.toLowerCase().includes('heartbeat')
        );
        
        let nextInMs: number;
        if (cronJob?.nextRun) {
          nextInMs = Math.max(0, new Date(cronJob.nextRun).getTime() - now);
        } else {
          // Fallback: estimate from session activity age
          const agentSessions = sessionsByAgent[hb.agentId] || [];
          const lastActivity = agentSessions[0]?.age || intervalMs;
          nextInMs = Math.max(0, intervalMs - (lastActivity % intervalMs));
        }

        return {
          agentId: hb.agentId,
          nextIn: formatDuration(nextInMs),
          nextInMs,
          intervalMs,
        };
      })
      .sort((a: any, b: any) => a.nextInMs - b.nextInMs);

    // Sessions summary
    const atCapacity = recentSessions.filter((s: any) => s.percentUsed >= 95).length;

    const response: StatusResponse = {
      gateway: {
        status: "connected",
        url: "ws://127.0.0.1:18789",
      },
      agents,
      sessions: {
        total: statusData.sessions?.count || 0,
        atCapacity,
        byAgent: Object.entries(byAgentMap).map(([agentId, data]) => ({
          agentId,
          count: (data as any).count,
          recent: ((data as any).recent || []).slice(0, 10).map((s: any) => ({
            key: s.key, agentId: s.agentId, kind: s.kind, model: s.model,
            percentUsed: s.percentUsed, totalTokens: s.totalTokens,
            remainingTokens: s.remainingTokens, contextTokens: s.contextTokens,
            updatedAt: s.updatedAt, age: s.age, abortedLastRun: s.abortedLastRun,
            systemSent: s.systemSent,
          })),
        })),
        recent: recentSessions.slice(0, 10).map((s: any) => ({
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
        defaultAgentId: statusData.heartbeat?.defaultAgentId || "main",
        nextHeartbeats,
      },
      channels: statusData.channelSummary || [],
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
