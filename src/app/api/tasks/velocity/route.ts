// Mission Control - Velocity Tracking API
// Agent throughput metrics and smart task assignment
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const VELOCITY_HOOK = `${process.env.HOME}/.openclaw/hooks/task-velocity.sh`;
const DB_PATH = `${process.env.HOME}/.openclaw/data/tasks.db`;

/**
 * GET /api/tasks/velocity
 * Get velocity metrics for all agents or a specific agent.
 * 
 * Query: ?agent=<agentId> (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const agent = request.nextUrl.searchParams.get('agent');
    
    const query = agent
      ? `SELECT * FROM agent_velocity WHERE agent = '${agent}';`
      : `SELECT * FROM agent_velocity ORDER BY completed_7d DESC;`;

    const { stdout } = await execAsync(
      `sqlite3 -json "${DB_PATH}" "${query}"`,
      { timeout: 10000 }
    );

    const velocity = JSON.parse(stdout || '[]');
    
    // Also get snapshot trends (last 7 days)
    const trendQuery = agent
      ? `SELECT * FROM velocity_snapshots WHERE agent = '${agent}' ORDER BY date DESC LIMIT 7;`
      : `SELECT * FROM velocity_snapshots ORDER BY date DESC LIMIT 50;`;
    
    let trends: any[] = [];
    try {
      const { stdout: trendOut } = await execAsync(
        `sqlite3 -json "${DB_PATH}" "${trendQuery}"`,
        { timeout: 5000 }
      );
      trends = JSON.parse(trendOut || '[]');
    } catch { /* trends table might be empty */ }

    return NextResponse.json({
      velocity,
      trends,
    });
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
        
        // Parse the recommended agent from output
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
