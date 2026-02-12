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

function normalizeSession(raw: RawSession, agentId: string) {
  return {
    key: raw.key,
    kind: raw.kind || 'direct',
    agentId: agentId,
    model: raw.model || 'unknown',
    tokens: {
      used: raw.totalTokens || (raw.inputTokens || 0) + (raw.outputTokens || 0),
      limit: raw.contextTokens || 200000,
      input: raw.inputTokens || 0,
      output: raw.outputTokens || 0,
    },
    lastActivity: new Date(raw.updatedAt).toISOString(),
    compactions: 0, // Not available from CLI
    sessionId: raw.sessionId,
  };
}
