// Mission Control - Taskmaster Status API
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getOpenClawStatus } from '@/lib/statusCache';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

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

    // Get OpenClaw status for agent activity and next heartbeat
    const status = await getOpenClawStatus();
    
    // Check if taskmaster is active (updated in last 30 minutes)
    const taskmasterAgent = status.agents?.agents?.find((a: any) => a.id === 'taskmaster');
    const lastActiveMs = taskmasterAgent?.lastActiveAgeMs;
    const taskmasterActive = lastActiveMs !== null && lastActiveMs < 30 * 60 * 1000;

    // Get last triage run from taskmaster agent's memory logs
    let lastTriageRun: string | null = null;
    try {
      const memoryDir = join(homedir(), '.openclaw', 'workspace-taskmaster', 'memory');
      const files = await readdir(memoryDir);
      
      // Filter for YYYY-MM-DD.md files and sort desc
      const logFiles = files
        .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
        .sort((a, b) => b.localeCompare(a));

      if (logFiles.length > 0) {
        const latestFile = logFiles[0];
        const datePart = latestFile.slice(0, 10);
        const logContent = await readFile(join(memoryDir, latestFile), 'utf-8');
        
        // Look for timestamp patterns: "## Morning Check (08:12)" or "## Triage (14:30)"
        const timestampMatch = logContent.match(/## .* \((\d{2}:\d{2})\)/);
        if (timestampMatch) {
          lastTriageRun = `${datePart}T${timestampMatch[1]}:00`;
        } else {
          // Fallback: use file date
          lastTriageRun = `${datePart}T00:00:00`;
        }
      }
    } catch (error) {
      console.warn('Could not read taskmaster log:', error);
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
