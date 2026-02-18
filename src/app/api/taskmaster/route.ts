// Mission Control - Taskmaster Status API
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getOpenClawStatus } from '@/lib/statusCache';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { exec } from 'child_process';

export async function GET() {
  try {
    const db = getDb();

    // Get intake queue size
    const intakeCount = db
      .prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'intake'")
      .get() as { count: number };

    // Get SLA breach count + details
    const slaBreaches = db
      .prepare("SELECT COUNT(*) as count FROM tasks WHERE slaBreached = 1")
      .get() as { count: number };

    const slaBreachedTasks = db
      .prepare(`SELECT id, title, status, priority, assignedTo, list, dueDate, createdAt
        FROM tasks WHERE slaBreached = 1 ORDER BY priority DESC, createdAt ASC LIMIT 10`)
      .all() as Array<{
        id: string; title: string; status: string; priority: string;
        assignedTo: string | null; list: string; dueDate: string | null; createdAt: string;
      }>;

    // Get model tier breakdown for ready/in_progress tasks
    const modelTiers = db
      .prepare(`
        SELECT
          recommendedModel,
          COUNT(*) as count
        FROM tasks
        WHERE status IN ('ready', 'in_progress')
        GROUP BY recommendedModel
      `)
      .all() as Array<{ recommendedModel: string | null; count: number }>;

    // Map model tiers
    const tierBreakdown = { flash: 0, sonnet: 0, opus: 0, other: 0 };
    for (const tier of modelTiers) {
      const model = (tier.recommendedModel || '').toLowerCase();
      if (model.includes('flash')) tierBreakdown.flash += tier.count;
      else if (model.includes('sonnet')) tierBreakdown.sonnet += tier.count;
      else if (model.includes('opus')) tierBreakdown.opus += tier.count;
      else tierBreakdown.other += tier.count;
    }

    // Get task status breakdown
    const statusBreakdown = db
      .prepare(`SELECT status, COUNT(*) as count FROM tasks GROUP BY status`)
      .all() as Array<{ status: string; count: number }>;

    const tasksByStatus: Record<string, number> = {};
    for (const row of statusBreakdown) tasksByStatus[row.status] = row.count;

    // Check taskmaster agent activity
    const statusData = await getOpenClawStatus();
    const agents = statusData?.agents?.agents || [];
    const taskmasterAgent = agents.find((a: any) => a.id === 'taskmaster');
    const taskmasterActive = taskmasterAgent?.lastActiveAgeMs ? taskmasterAgent.lastActiveAgeMs < 300000 : false;

    // Get last triage run from daily notes
    let lastTriageRun: string | null = null;
    const notesDir = join(homedir(), '.openclaw', 'workspace-taskmaster', 'memory');
    try {
      const files = await readdir(notesDir);
      const dateFiles = files.filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f)).sort().reverse();
      if (dateFiles.length > 0) {
        lastTriageRun = dateFiles[0].replace('.md', '') + 'T00:00:00';
      }
    } catch {}

    return NextResponse.json({
      active: taskmasterActive,
      lastTriageRun,
      intakeQueue: intakeCount.count,
      slaBreaches: slaBreaches.count,
      slaBreachedTasks,
      modelTiers: tierBreakdown,
      tasksByStatus,
      triageStale: lastTriageRun ? (Date.now() - new Date(lastTriageRun).getTime()) > 86400000 : true,
    });
  } catch (error) {
    console.error('Taskmaster API error:', error);
    return NextResponse.json({
      active: false,
      lastTriageRun: null,
      intakeQueue: 0,
      slaBreaches: 0,
      slaBreachedTasks: [],
      modelTiers: { flash: 0, sonnet: 0, opus: 0, other: 0 },
      tasksByStatus: {},
      triageStale: true,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// POST - trigger triage run
export async function POST() {
  try {
    const TRIAGE_CRON_ID = "a6067fb6-8bdc-46e7-a935-d337a5e738f4";
    return new Promise<NextResponse>((resolve) => {
      exec(
        `openclaw cron run ${TRIAGE_CRON_ID} --force --json`,
        { timeout: 15000, env: { ...process.env, PATH: `${homedir()}/.local/bin:${process.env.PATH}` } },
        (error, stdout, stderr) => {
          if (error) {
            resolve(NextResponse.json({ success: false, error: stderr || error.message }, { status: 500 }));
          } else {
            resolve(NextResponse.json({ success: true, output: stdout.trim() }));
          }
        }
      );
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
