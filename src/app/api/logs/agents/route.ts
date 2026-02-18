// Mission Control - Agent Demuxed Logs API
// Reads from ~/.openclaw/logs/agents/<agentId>/openclaw.jsonl
// produced by log-demux-by-agent.sh
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const AGENT_LOGS_DIR = path.join(os.homedir(), '.openclaw', 'logs', 'agents');

interface AgentLogEntry {
  timestamp?: string;
  level?: string;
  message?: string;
  agent?: string;
  [key: string]: any;
}

interface AgentLogSummary {
  agentId: string;
  entryCount: number;
  recentEntries: AgentLogEntry[];
  lastActivity?: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const agentId = searchParams.get('agentId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

    // If specific agent requested, return that agent's logs
    if (agentId) {
      const logPath = path.join(AGENT_LOGS_DIR, agentId, 'openclaw.jsonl');
      try {
        const content = await fs.readFile(logPath, 'utf-8');
        const lines = content.split('\n').filter(Boolean);
        const entries: AgentLogEntry[] = [];

        // Read from the end (most recent) 
        const startIdx = Math.max(0, lines.length - limit);
        for (let i = startIdx; i < lines.length; i++) {
          try {
            entries.push(JSON.parse(lines[i]));
          } catch {
            // Skip malformed lines
            entries.push({ message: lines[i], level: 'info' });
          }
        }

        return NextResponse.json({
          agentId,
          entries: entries.reverse(), // newest first
          totalEntries: lines.length,
        });
      } catch {
        return NextResponse.json({ agentId, entries: [], totalEntries: 0 });
      }
    }

    // List all agents with their recent log entries
    let agentDirs: string[] = [];
    try {
      agentDirs = await fs.readdir(AGENT_LOGS_DIR);
    } catch {
      // Directory doesn't exist yet — run the demux script
      return NextResponse.json({ agents: [], note: 'No agent logs yet. Run log-demux-by-agent.sh to generate.' });
    }

    const agents: AgentLogSummary[] = [];

    for (const dir of agentDirs) {
      const logPath = path.join(AGENT_LOGS_DIR, dir, 'openclaw.jsonl');
      try {
        const stat = await fs.stat(logPath);
        if (!stat.isFile()) continue;

        const content = await fs.readFile(logPath, 'utf-8');
        const lines = content.split('\n').filter(Boolean);
        
        // Get last N entries
        const recentLimit = Math.min(limit, 30);
        const startIdx = Math.max(0, lines.length - recentLimit);
        const recentEntries: AgentLogEntry[] = [];

        for (let i = startIdx; i < lines.length; i++) {
          try {
            recentEntries.push(JSON.parse(lines[i]));
          } catch {
            recentEntries.push({ message: lines[i], level: 'info' });
          }
        }

        // Find last activity timestamp
        let lastActivity: string | undefined;
        for (let i = recentEntries.length - 1; i >= 0; i--) {
          if (recentEntries[i].timestamp) {
            lastActivity = recentEntries[i].timestamp;
            break;
          }
        }

        agents.push({
          agentId: dir,
          entryCount: lines.length,
          recentEntries: recentEntries.reverse(), // newest first
          lastActivity,
        });
      } catch {
        // Skip agents we can't read
      }
    }

    // Sort by most recent activity
    agents.sort((a, b) => {
      if (!a.lastActivity && !b.lastActivity) return 0;
      if (!a.lastActivity) return 1;
      if (!b.lastActivity) return -1;
      return b.lastActivity.localeCompare(a.lastActivity);
    });

    return NextResponse.json({ agents });
  } catch (error) {
    console.error('Agent logs API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to read agent logs' },
      { status: 500 }
    );
  }
}
