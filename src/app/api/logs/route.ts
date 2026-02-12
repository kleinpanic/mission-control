// Mission Control - Logs API
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const OPENCLAW_HOME = path.join(os.homedir(), '.openclaw');
const LOGS_DIR = path.join(OPENCLAW_HOME, 'logs');

interface LogEntry {
  timestamp: string;
  level: 'error' | 'warning' | 'info' | 'debug';
  message: string;
  file?: string;
  line?: number;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const source = searchParams.get('source') || 'openclaw';
    const limit = parseInt(searchParams.get('limit') || '100');
    const level = searchParams.get('level'); // filter by level

    let logPath: string;
    let entries: LogEntry[] = [];

    if (source === 'openclaw') {
      logPath = path.join(LOGS_DIR, 'openclaw.log');
      const content = await fs.readFile(logPath, 'utf-8');
      const lines = content.split('\n').filter(Boolean).slice(-limit);
      
      entries = lines.map(line => parseLogLine(line));
    } else if (source === 'audit') {
      logPath = path.join(LOGS_DIR, 'audit-trail.jsonl');
      const content = await fs.readFile(logPath, 'utf-8');
      const lines = content.split('\n').filter(Boolean).slice(-limit);
      
      entries = lines.map(line => {
        try {
          const json = JSON.parse(line);
          return {
            timestamp: json.timestamp || new Date().toISOString(),
            level: json.level || 'info',
            message: json.message || JSON.stringify(json),
            file: json.file,
            line: json.line,
          };
        } catch {
          return {
            timestamp: new Date().toISOString(),
            level: 'info' as const,
            message: line,
          };
        }
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid source' },
        { status: 400 }
      );
    }

    // Filter by level if specified
    if (level) {
      entries = entries.filter(e => e.level === level);
    }

    return NextResponse.json({ entries });
  } catch (error) {
    console.error('Logs API error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to read logs',
        entries: []
      },
      { status: 500 }
    );
  }
}

function parseLogLine(line: string): LogEntry {
  // Try to parse as JSON first (OpenClaw format)
  try {
    const json = JSON.parse(line);
    
    // OpenClaw JSON log format has:
    // - "time": ISO timestamp
    // - "_meta.logLevelName": DEBUG|INFO|WARN|ERROR
    // - "_meta.path.filePathWithLine": file:line
    // - "1": the main message (or "2" for some logs)
    
    const meta = json._meta || {};
    const levelStr = (meta.logLevelName || 'INFO').toUpperCase();
    
    let level: LogEntry['level'] = 'info';
    if (levelStr === 'ERROR') level = 'error';
    else if (levelStr === 'WARN' || levelStr === 'WARNING') level = 'warning';
    else if (levelStr === 'INFO') level = 'info';
    else if (levelStr === 'DEBUG') level = 'debug';

    // Extract message - can be in "1" or "2" field
    let message = json['1'] || json['2'] || '';
    if (typeof message === 'object') {
      message = JSON.stringify(message);
    }
    
    // Add subsystem context if available
    const subsystem = json['0'];
    if (subsystem && typeof subsystem === 'string') {
      try {
        const sub = JSON.parse(subsystem);
        if (sub.subsystem) {
          message = `[${sub.subsystem}] ${message}`;
        } else if (sub.module) {
          message = `[${sub.module}] ${message}`;
        }
      } catch {
        // subsystem is not JSON, use as-is
      }
    }

    const filePath = meta.path?.filePathWithLine || meta.path?.filePath;
    const lineNum = meta.path?.fileLine ? parseInt(meta.path.fileLine) : undefined;

    return {
      timestamp: json.time || meta.date || new Date().toISOString(),
      level,
      message: message || line,
      file: filePath,
      line: lineNum,
    };
  } catch {
    // Fall back to plain text parsing
  }

  // Parse common log formats
  // Example: [2024-02-12 02:45:32] ERROR: Something went wrong
  const timestampMatch = line.match(/\[([^\]]+)\]/);
  const levelMatch = line.match(/\b(ERROR|WARN|WARNING|INFO|DEBUG)\b/i);
  
  let level: LogEntry['level'] = 'info';
  if (levelMatch) {
    const levelStr = levelMatch[1].toUpperCase();
    if (levelStr === 'ERROR') level = 'error';
    else if (levelStr === 'WARN' || levelStr === 'WARNING') level = 'warning';
    else if (levelStr === 'INFO') level = 'info';
    else if (levelStr === 'DEBUG') level = 'debug';
  }

  // Extract file references
  const fileMatch = line.match(/\b([a-zA-Z0-9_\-/.]+\.(ts|js|tsx|jsx|py|go|rs))/);
  const lineNumberMatch = line.match(/:(\d+)(?::\d+)?$/);

  return {
    timestamp: timestampMatch ? timestampMatch[1] : new Date().toISOString(),
    level,
    message: line,
    file: fileMatch ? fileMatch[1] : undefined,
    line: lineNumberMatch ? parseInt(lineNumberMatch[1]) : undefined,
  };
}
