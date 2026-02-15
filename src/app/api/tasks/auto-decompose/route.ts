// Mission Control - Auto-Decompose API
// Programmatic endpoint for auto-decomposing tasks based on complexity
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const AUTO_DECOMPOSE_HOOK = `${process.env.HOME}/.openclaw/hooks/task-auto-decompose.sh`;

/**
 * POST /api/tasks/auto-decompose
 * Auto-decompose a specific task or scan all eligible tasks.
 * 
 * Body: { taskId?: string, scan?: boolean }
 *   - taskId: Decompose a specific task
 *   - scan: true → Scan all eligible tasks (moderate/complex with no subtasks)
 * 
 * Response: { ok: boolean, output: string, decomposed?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, scan } = body;

    if (!taskId && !scan) {
      return NextResponse.json(
        { error: 'Provide taskId or set scan: true' },
        { status: 400 }
      );
    }

    const cmd = scan ? `${AUTO_DECOMPOSE_HOOK} --scan` : `${AUTO_DECOMPOSE_HOOK} "${taskId}"`;
    
    const { stdout, stderr } = await execAsync(cmd, { timeout: 120000 });

    // Parse output for decomposition count
    const decomposedMatch = stdout.match(/Auto-decomposed (\d+) tasks/);
    const decomposed = decomposedMatch ? parseInt(decomposedMatch[1]) : (stdout.includes('✅') ? 1 : 0);

    return NextResponse.json({
      ok: true,
      output: stdout,
      warnings: stderr || undefined,
      decomposed,
    });
  } catch (error) {
    console.error('[auto-decompose] Error:', error);
    const stderr = (error as any)?.stderr || '';
    const stdout = (error as any)?.stdout || '';
    
    // Exit code 2 = skipped (not eligible)
    if ((error as any)?.code === 2) {
      return NextResponse.json({
        ok: true,
        output: stdout || stderr,
        decomposed: 0,
        skipped: true,
      });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error', output: stdout, stderr },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tasks/auto-decompose?eligible=true
 * List tasks eligible for auto-decomposition (moderate/complex with no subtasks)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const eligible = searchParams.get('eligible') === 'true';

    if (!eligible) {
      return NextResponse.json({ error: 'Use ?eligible=true to list eligible tasks' }, { status: 400 });
    }

    const { stdout } = await execAsync(
      `sqlite3 -json ${process.env.HOME}/.openclaw/data/tasks.db "
        SELECT t.id, t.title, t.complexity, t.status, t.priority
        FROM tasks t
        WHERE t.complexity IN ('moderate', 'epic')
        AND t.status IN ('intake', 'ready')
        AND NOT EXISTS (SELECT 1 FROM tasks child WHERE child.parentId = t.id)
        AND COALESCE(json_extract(t.metadata, '$.decomposed'), 0) != 1
        ORDER BY 
          CASE t.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
          t.createdAt ASC;
      "`,
      { timeout: 10000 }
    );

    const tasks = JSON.parse(stdout || '[]');
    return NextResponse.json({ tasks, count: tasks.length });
  } catch (error) {
    console.error('[auto-decompose] List error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
