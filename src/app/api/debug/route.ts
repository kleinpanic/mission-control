// Mission Control - Debug Info API
import { NextResponse } from 'next/server';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const OPENCLAW_HOME = path.join(os.homedir(), '.openclaw');

interface DebugInfo {
  system: {
    platform: string;
    arch: string;
    hostname: string;
    uptime: number;
    memory: {
      total: number;
      free: number;
      used: number;
    };
    cpu: {
      model: string;
      cores: number;
    };
  };
  gateway: {
    status: 'running' | 'stopped' | 'unknown';
    url: string;
    version?: string;
  };
  openclaw: {
    configPath: string;
    logsPath: string;
    workspacePath: string;
  };
  node: {
    version: string;
  };
}

let debugCache: { data: any; time: number } | null = null;
const DEBUG_TTL = 60_000;

export async function GET() {
  try {
    const now = Date.now();
    if (debugCache && now - debugCache.time < DEBUG_TTL) {
      return NextResponse.json(debugCache.data);
    }
    const debugInfo: DebugInfo = {
      system: {
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        uptime: os.uptime(),
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem(),
        },
        cpu: {
          model: os.cpus()[0]?.model || 'Unknown',
          cores: os.cpus().length,
        },
      },
      gateway: {
        status: 'unknown',
        url: process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789',
      },
      openclaw: {
        configPath: path.join(OPENCLAW_HOME, 'openclaw.json'),
        logsPath: path.join(OPENCLAW_HOME, 'logs'),
        workspacePath: path.join(OPENCLAW_HOME, 'workspace-dev'),
      },
      node: {
        version: process.version,
      },
    };

    // Check gateway status
    try {
      const { stdout } = await execAsync('systemctl --user is-active openclaw-gateway 2>/dev/null', {
        timeout: 2000,
      });
      debugInfo.gateway.status = stdout.trim() === 'active' ? 'running' : 'stopped';
    } catch {
      debugInfo.gateway.status = 'unknown';
    }

    // Try to get OpenClaw version
    try {
      const { stdout } = await execAsync('openclaw --version 2>/dev/null', {
        timeout: 2000,
      });
      debugInfo.gateway.version = stdout.trim();
    } catch {
      // Version unavailable
    }

    debugCache = { data: debugInfo, time: Date.now() };
    return NextResponse.json(debugInfo);
  } catch (error) {
    console.error('Debug info API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get debug info' },
      { status: 500 }
    );
  }
}
