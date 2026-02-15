// Mission Control - Taskmaster Status API
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

const execAsync = promisify(exec);

export async function GET() {
  try {
    const db = getDb();

    // Get intake queue size
    const intakeCount = db
      .prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'intake'")
      .get() as { count: number };

    // Get SLA breach count
    const slaBreaches = db
      .prepare("SELECT COUNT(*) as count FROM tasks WHERE slaBreached = 1")
      .get() as { count: number };

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
      .all() as Array<{ recommendedModel: string; count: number }>;

    const tierBreakdown = {
      flash: 0,
      sonnet: 0,
      opus: 0,
      other: 0,
    };

    for (const tier of modelTiers) {
      const model = tier.recommendedModel || 'unknown';
      if (model.includes('flash')) {
        tierBreakdown.flash += tier.count;
      } else if (model.includes('sonnet')) {
        tierBreakdown.sonnet += tier.count;
      } else if (model.includes('opus')) {
        tierBreakdown.opus += tier.count;
      } else {
        tierBreakdown.other += tier.count;
      }
    }

    // Get last triage run from taskmaster agent's daily log
    let lastTriageRun: string | null = null;
    try {
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const logPath = join(
        homedir(),
        '.openclaw',
        'workspace-taskmaster',
        'memory',
        `${today}.md`
      );
      const logContent = await readFile(logPath, 'utf-8');
      
      // Look for timestamp patterns in the log
      const timestampMatch = logContent.match(/## .* \((\d{2}:\d{2})\)/);
      if (timestampMatch) {
        lastTriageRun = `${today}T${timestampMatch[1]}:00`;
      }
    } catch (error) {
      // Log file doesn't exist or can't be read - that's okay
      console.log('Could not read taskmaster log:', error);
    }

    // Get taskmaster agent status from sessions
    let taskmasterActive = false;
    try {
      const { stdout } = await execAsync(
        'openclaw sessions list --agent taskmaster --format json 2>/dev/null || echo "[]"',
        { timeout: 5000 }
      );
      const sessions = JSON.parse(stdout || '[]');
      taskmasterActive = sessions.length > 0 && sessions.some((s: any) => {
        const updated = s.updatedAt || 0;
        return Date.now() - updated < 30 * 60 * 1000; // Active if updated <30min ago
      });
    } catch (error) {
      console.warn('Could not check taskmaster sessions:', error);
    }

    return NextResponse.json({
      active: taskmasterActive,
      lastTriageRun,
      intakeQueue: intakeCount.count,
      slaBreaches: slaBreaches.count,
      modelTiers: tierBreakdown,
    });
  } catch (error) {
    console.error('Taskmaster API error:', error);
    return NextResponse.json({
      active: false,
      lastTriageRun: null,
      intakeQueue: 0,
      slaBreaches: 0,
      modelTiers: { flash: 0, sonnet: 0, opus: 0, other: 0 },
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
