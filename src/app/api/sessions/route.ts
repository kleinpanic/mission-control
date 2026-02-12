// Mission Control - Sessions API
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Cache for 15 seconds (sessions change frequently)
let cachedData: any = null;
let cacheTimestamp = 0;
const CACHE_TTL = 15 * 1000;

interface RawSession {
  key: string;
  kind: string;
  updatedAt: number;
  ageMs: number;
  sessionId: string;
  systemSent?: boolean;
  abortedLastRun?: boolean;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  model?: string;
  contextTokens?: number;
}

export async function GET(request: NextRequest) {
  try {
    const now = Date.now();
    
    // Return cached data if still valid
    if (cachedData && (now - cacheTimestamp) < CACHE_TTL) {
      return NextResponse.json(cachedData);
    }

    // Fetch sessions using openclaw CLI (uses default agent, gets all sessions)
    const { stdout } = await execAsync(
      'openclaw sessions list --json',
      { timeout: 15000 }
    );
    
    const data = JSON.parse(stdout);
    const allSessions = (data.sessions || []).map((session: RawSession) => {
      // Extract agentId from session key (format: agent:main:...)
      const keyParts = session.key.split(':');
      const agentId = keyParts[1] || 'main';
      return normalizeSession(session, agentId);
    });

    // Sort by updatedAt (most recent first)
    allSessions.sort((a: any, b: any) => {
      const aTime = new Date(a.lastActivity).getTime();
      const bTime = new Date(b.lastActivity).getTime();
      return bTime - aTime;
    });

    const result = { sessions: allSessions };

    // Update cache
    cachedData = result;
    cacheTimestamp = now;

    return NextResponse.json(result);
  } catch (error) {
    console.error('Sessions API error:', error);
    return NextResponse.json(
      { 
        sessions: [],
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

function normalizeSession(raw: any, agentId: string) {
  const totalTokens = raw.totalTokens || (raw.inputTokens || 0) + (raw.outputTokens || 0);
  const contextTokens = raw.contextTokens || 200000;
  const percentUsed = Math.round((totalTokens / contextTokens) * 100);
  
  return {
    key: raw.key,
    kind: raw.kind || 'direct',
    agentId: agentId,
    model: raw.model || 'unknown',
    tokens: {
      used: totalTokens,
      limit: contextTokens,
      input: raw.inputTokens || 0,
      output: raw.outputTokens || 0,
    },
    percentUsed,
    lastActivity: new Date(raw.updatedAt).toISOString(),
    compactionCount: raw.compactionCount || 0,
    sessionId: raw.sessionId,
    flags: raw.flags || [],
    // Add context about auto-compaction
    canCompact: percentUsed > 80,
    compactionStatus: percentUsed >= 100 ? 'at_capacity' : percentUsed > 80 ? 'approaching' : 'ok',
  };
}

/**
 * POST /api/sessions
 * Actions: compact, prune, reset
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, sessionKey, agentId } = body;

    if (!action) {
      return NextResponse.json({ error: 'Missing action' }, { status: 400 });
    }

    // Invalidate cache for any action
    cachedData = null;
    cacheTimestamp = 0;

    switch (action) {
      case 'compact': {
        // Trigger compaction via gateway
        // Note: OpenClaw may not expose a direct compact command
        // This would need to be implemented in openclaw CLI
        const { stdout } = await execAsync(
          `openclaw gateway compact --session "${sessionKey}" --json 2>&1 || echo '{"error":"not_implemented"}'`,
          { timeout: 30000 }
        );
        
        try {
          const result = JSON.parse(stdout);
          if (result.error === 'not_implemented') {
            return NextResponse.json({ 
              success: false, 
              error: 'Session compaction not yet exposed via CLI. Auto-compaction occurs automatically when context fills.' 
            });
          }
          return NextResponse.json({ success: true, result });
        } catch {
          return NextResponse.json({ success: true, output: stdout });
        }
      }

      case 'prune': {
        // Delete/reset a session
        const { stdout } = await execAsync(
          `openclaw sessions reset --session "${sessionKey}" --json 2>&1 || echo '{"error":"command_failed"}'`,
          { timeout: 30000 }
        );
        
        try {
          const result = JSON.parse(stdout);
          return NextResponse.json({ success: !result.error, result });
        } catch {
          return NextResponse.json({ success: true, output: stdout });
        }
      }

      case 'reset': {
        // Same as prune but more explicit
        const { stdout } = await execAsync(
          `openclaw sessions reset --agent "${agentId || 'main'}" --session "${sessionKey}" 2>&1`,
          { timeout: 30000 }
        );
        return NextResponse.json({ success: true, output: stdout });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('Sessions API POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
