// Mission Control - Cron API
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Cache for 30 seconds
let cachedData: any = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30 * 1000;

export async function GET(request: NextRequest) {
  try {
    const now = Date.now();
    
    // Return cached data if still valid
    if (cachedData && (now - cacheTimestamp) < CACHE_TTL) {
      return NextResponse.json(cachedData);
    }

    // Fetch cron jobs from openclaw CLI
    const { stdout, stderr } = await execAsync(
      'openclaw cron list --json',
      { timeout: 15000 }
    );

    // Parse the JSON output (skip any plugin messages)
    const lines = stdout.split('\n');
    let jsonStart = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('{')) {
        jsonStart = i;
        break;
      }
    }

    if (jsonStart === -1) {
      throw new Error('No JSON output from openclaw cron list');
    }

    const jsonStr = lines.slice(jsonStart).join('\n');
    const data = JSON.parse(jsonStr);

    // Normalize the job format for the frontend
    const normalizedJobs = (data.jobs || []).map((job: any) => ({
      id: job.id,
      name: job.name || job.id,
      status: job.enabled ? 'active' : 'disabled',
      schedule: job.schedule,
      payload: job.payload,
      sessionTarget: job.sessionTarget,
      enabled: job.enabled,
      nextRun: job.state?.nextRunAtMs ? new Date(job.state.nextRunAtMs).toISOString() : null,
      lastRun: job.state?.lastRunAtMs ? {
        timestamp: new Date(job.state.lastRunAtMs).toISOString(),
        status: job.state.lastStatus === 'ok' ? 'success' : 'failure',
        error: job.state.lastError,
      } : undefined,
      agentId: job.agentId,
    }));

    const result = { jobs: normalizedJobs };

    // Update cache
    cachedData = result;
    cacheTimestamp = now;

    return NextResponse.json(result);
  } catch (error) {
    console.error('Cron API error:', error);
    return NextResponse.json(
      { 
        jobs: [],
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, jobId } = body;

    if (action === 'run' && jobId) {
      const { stdout, stderr } = await execAsync(
        `openclaw cron run ${jobId} --force --json`,
        { timeout: 30000 }
      );
      
      // Invalidate cache
      cachedData = null;
      cacheTimestamp = 0;
      
      return NextResponse.json({ success: true, output: stdout });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Cron action error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
