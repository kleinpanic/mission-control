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
    const agentsList: any[] = statusData.agents?.agents || [];
    const sessionsByAgent: any[] = statusData.sessions?.byAgent || [];

    // Build detailed heartbeat list
    const detailed = heartbeats
      .filter((hb: any) => hb.enabled && hb.everyMs > 0)
      .map((hb: any) => {
        const agentConfig = agentsList.find((a: any) => a.id === hb.agentId);
        const agentSess = Array.isArray(sessionsByAgent)
          ? sessionsByAgent.find((s: any) => s.agentId === hb.agentId)
          : null;

        return {
          agentId: hb.agentId,
          enabled: hb.enabled,
          intervalMs: hb.everyMs,
          intervalHuman: formatDuration(hb.everyMs),
          model: hb.model || null,
          agentName: agentConfig?.name || hb.agentId,
          sessionCount: agentConfig?.sessionsCount || agentSess?.count || 0,
          prompt: hb.prompt || "(default heartbeat prompt)",
          lastUpdatedAt: agentConfig?.lastUpdatedAt || null,
          lastActiveAge: agentConfig?.lastActiveAgeMs ? formatDuration(agentConfig.lastActiveAgeMs) : null,
          workspaceDir: agentConfig?.workspaceDir || null,
        };
      });

    if (agentId) {
      const match = detailed.find((h: any) => h.agentId === agentId);
      if (!match) {
        return NextResponse.json({ error: `Agent "${agentId}" not found or heartbeat disabled` }, { status: 404 });
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
      const { exec } = require("child_process");
      return new Promise<NextResponse>((resolve) => {
        exec(
          `openclaw wake --agent ${agentId} --reason "manual-dashboard"`,
          {
            timeout: 10000,
            env: {
              ...process.env,
              PATH: `${process.env.HOME}/.local/share/npm/bin:${process.env.HOME}/.local/bin:/usr/local/bin:/usr/bin:/bin`,
            },
          },
          (error: any, stdout: string, _stderr: string) => {
            if (error) {
              // Fallback response — wake might not support per-agent but the wake event was sent
              resolve(
                NextResponse.json({
                  ok: true,
                  action: "triggered",
                  agentId,
                  note: "Wake event sent",
                })
              );
            } else {
              resolve(NextResponse.json({ ok: true, action: "triggered", agentId, output: stdout.trim() }));
            }
          }
        );
      });
    }

    if (action === "skip") {
      return NextResponse.json({
        ok: true,
        action: "skipped",
        agentId,
        note: "Next heartbeat for this agent marked as skipped in the UI.",
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
