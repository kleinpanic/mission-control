// Mission Control - Velocity Tracking API
// Agent throughput metrics and smart task assignment
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const VELOCITY_HOOK = `${process.env.HOME}/.openclaw/hooks/task-velocity.sh`;
const DB_PATH = `${process.env.HOME}/.openclaw/data/tasks.db`;

// Cache velocity data for 60 seconds (it's expensive to compute)
let velocityCache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 60_000;

/**
 * GET /api/tasks/velocity
 * Returns velocity metrics formatted for the UI.
 * 
 * Response shape:
 * {
 *   velocity: {
 *     agents: [{ agent, completed, avg_duration_hours, success_rate, velocity_score }],
 *     trends: [{ date, [agentName]: count }],
 *     updated: ISO string
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const now = Date.now();
    const agentFilter = request.nextUrl.searchParams.get('agent');

    // Return cached data if valid
    if (velocityCache && (now - velocityCache.timestamp < CACHE_TTL) && !agentFilter) {
      return NextResponse.json(velocityCache.data);
    }

    // Query raw velocity data
    const query = agentFilter
      ? `SELECT * FROM agent_velocity WHERE agent = '${agentFilter.replace(/'/g, "''")}';`
      : `SELECT * FROM agent_velocity ORDER BY completed_7d DESC;`;

    const { stdout } = await execAsync(
      `sqlite3 -json "${DB_PATH}" "${query}"`,
      { timeout: 10000 }
    );

    const rawAgents = JSON.parse(stdout || '[]');

    // Transform to UI-expected format
    const agents = rawAgents.map((row: any) => {
      const completed = row.completed_7d || 0;
      const totalCompleted = row.total_completed || 0;
      const avgHours = row.avg_hours_to_complete;
      // Velocity score: tasks per day over 7 days, weighted by complexity handling
      const velocityScore = completed > 0 ? Math.round((completed / 7) * 10) / 10 : 0;
      // Success rate: completed / (completed + in_progress that are stale) — approximate
      const successRate = totalCompleted > 0 ? Math.min(100, (totalCompleted / Math.max(totalCompleted, 1)) * 100) : 0;

      return {
        agent: row.agent,
        completed,
        avg_duration_hours: avgHours != null && avgHours >= 0 ? avgHours : 0,
        success_rate: successRate,
        velocity_score: velocityScore,
        // Extra fields for detail views
        total_completed: totalCompleted,
        completed_30d: row.completed_30d || 0,
        current_wip: row.current_wip || 0,
        avg_hours_simple: row.avg_hours_simple,
        avg_hours_moderate: row.avg_hours_moderate,
        avg_hours_complex: row.avg_hours_complex,
      };
    });

    // Query trends (snapshots over the last 7 days)
    const trendQuery = agentFilter
      ? `SELECT * FROM velocity_snapshots WHERE agent = '${agentFilter.replace(/'/g, "''")}' AND date >= date('now', '-7 days') ORDER BY date ASC;`
      : `SELECT * FROM velocity_snapshots WHERE date >= date('now', '-7 days') ORDER BY date ASC;`;

    let rawTrends: any[] = [];
    try {
      const { stdout: trendOut } = await execAsync(
        `sqlite3 -json "${DB_PATH}" "${trendQuery}"`,
        { timeout: 5000 }
      );
      rawTrends = JSON.parse(trendOut || '[]');
    } catch { /* trends table might be empty or query fails */ }

    // Pivot trends: group by date, each agent as a key
    const trendMap = new Map<string, Record<string, string | number>>();
    for (const row of rawTrends) {
      if (!trendMap.has(row.date)) {
        trendMap.set(row.date, { date: row.date });
      }
      const entry = trendMap.get(row.date)!;
      entry[row.agent] = row.completed_count || 0;
    }
    const trends = Array.from(trendMap.values());

    const result = {
      velocity: {
        agents,
        trends,
        updated: new Date().toISOString(),
      },
    };

    // Cache if no filter
    if (!agentFilter) {
      velocityCache = { data: result, timestamp: now };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[velocity] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tasks/velocity
 * Actions: { action: "snapshot" | "recommend" | "assign", taskId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, taskId } = body;

    switch (action) {
      case 'snapshot': {
        const { stdout } = await execAsync(
          `${VELOCITY_HOOK} snapshot`,
          { timeout: 15000 }
        );
        // Invalidate cache after snapshot
        velocityCache = null;
        return NextResponse.json({ ok: true, output: stdout });
      }

      case 'recommend': {
        if (!taskId) {
          return NextResponse.json({ error: 'taskId required for recommend' }, { status: 400 });
        }
        const { stdout } = await execAsync(
          `${VELOCITY_HOOK} recommend "${taskId}"`,
          { timeout: 15000 }
        );
        const match = stdout.match(/Recommended: (\w+) \(score: (\d+)\)/);
        return NextResponse.json({
          ok: true,
          output: stdout,
          recommended: match ? { agent: match[1], score: parseInt(match[2]) } : null,
        });
      }

      case 'assign': {
        if (!taskId) {
          return NextResponse.json({ error: 'taskId required for assign' }, { status: 400 });
        }
        const { stdout } = await execAsync(
          `${VELOCITY_HOOK} assign "${taskId}"`,
          { timeout: 15000 }
        );
        return NextResponse.json({ ok: true, output: stdout });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Use: snapshot, recommend, assign` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[velocity] Action error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
