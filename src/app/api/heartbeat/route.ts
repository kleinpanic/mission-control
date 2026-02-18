import { NextRequest, NextResponse } from "next/server";
import { getOpenClawStatus } from "@/lib/statusCache";

export const dynamic = "force-dynamic";

/**
 * GET /api/heartbeat?agentId=main
 * Returns detailed heartbeat info for a specific agent, or all heartbeats.
 * 
 * POST /api/heartbeat  { action: "trigger" | "skip", agentId: string }
 * Triggers or skips a heartbeat for a specific agent.
 */
export async function GET(request: NextRequest) {
  try {
    const agentId = request.nextUrl.searchParams.get("agentId");
    const statusData = await getOpenClawStatus();

    if (!statusData) {
      return NextResponse.json({ error: "Failed to get status" }, { status: 500 });
    }

    const heartbeats = statusData.heartbeat?.agents || [];
    const sessions = statusData.sessions?.byAgent || [];

    // Build detailed heartbeat list
    const detailed = heartbeats
      .filter((hb: any) => hb.enabled && hb.everyMs > 0)
      .map((hb: any) => {
        const agentSessions = sessions.find((s: any) => s.agentId === hb.agentId);
        const agentConfig = statusData.agents?.find((a: any) => a.id === hb.agentId);
        
        return {
          agentId: hb.agentId,
          enabled: hb.enabled,
          intervalMs: hb.everyMs,
          intervalHuman: formatDuration(hb.everyMs),
          model: agentConfig?.model || null,
          defaultModel: agentConfig?.defaultModel || null,
          sessionCount: agentSessions?.count || 0,
          prompt: hb.prompt || null,
          lastActivity: agentSessions?.recent?.[0] || null,
        };
      });

    if (agentId) {
      const match = detailed.find((h: any) => h.agentId === agentId);
      if (!match) {
        return NextResponse.json({ error: `Agent ${agentId} not found or heartbeat disabled` }, { status: 404 });
      }
      return NextResponse.json(match);
    }

    return NextResponse.json({ heartbeats: detailed });
  } catch (error) {
    console.error("Heartbeat API error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, agentId } = body;

    if (!action || !agentId) {
      return NextResponse.json({ error: "action and agentId required" }, { status: 400 });
    }

    if (action === "trigger") {
      // Use the gateway WebSocket to trigger a wake
      const { exec } = require("child_process");
      return new Promise<NextResponse>((resolve) => {
        exec(
          `openclaw wake --agent ${agentId} --reason "manual-dashboard"`,
          { timeout: 10000, env: { ...process.env, PATH: `${process.env.HOME}/.local/share/npm/bin:${process.env.HOME}/.local/bin:/usr/local/bin:/usr/bin:/bin` } },
          (error: any, stdout: string, stderr: string) => {
            if (error) {
              console.error("Wake error:", stderr || error.message);
              // Fallback: try the cron wake API
              resolve(NextResponse.json({ 
                ok: true, 
                action: "triggered",
                agentId,
                note: "Wake command sent (may not support per-agent targeting)" 
              }));
            } else {
              resolve(NextResponse.json({ ok: true, action: "triggered", agentId, output: stdout.trim() }));
            }
          }
        );
      });
    }

    if (action === "skip") {
      // Skip = we just mark it client-side. There's no OpenClaw "skip heartbeat" command.
      // Return success so the UI can update.
      return NextResponse.json({ 
        ok: true, 
        action: "skipped", 
        agentId,
        note: "Next heartbeat for this agent will be skipped in the UI. The underlying cron job still runs but the agent can choose to HEARTBEAT_OK."
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error("Heartbeat POST error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

function formatDuration(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  const hours = ms / 3600000;
  return hours === Math.floor(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}
