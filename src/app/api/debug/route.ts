// Mission Control - Debug Info API (Expanded)
import { NextResponse } from 'next/server';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
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
    disk?: {
      total: string;
      used: string;
      available: string;
      percentUsed: string;
    };
    loadAvg?: number[];
  };
  gateway: {
    status: 'running' | 'stopped' | 'unknown';
    url: string;
    version?: string;
    pid?: number;
  };
  openclaw: {
    configPath: string;
    logsPath: string;
    workspacePath: string;
    configSummary?: {
      agents?: number;
      channels?: string[];
      modelOverrides?: number;
    };
  };
  node: {
    version: string;
    npmVersion?: string;
  };
  recentErrors?: { timestamp: string; message: string }[];
  services?: { name: string; status: string }[];
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

    // Load average
    debugInfo.system.loadAvg = os.loadavg();

    // Check gateway status
    try {
      const { stdout } = await execAsync('systemctl --user is-active openclaw-gateway 2>/dev/null', {
        timeout: 2000,
      });
      debugInfo.gateway.status = stdout.trim() === 'active' ? 'running' : 'stopped';
    } catch {
      debugInfo.gateway.status = 'unknown';
    }

    // Gateway PID
    try {
      const { stdout } = await execAsync('systemctl --user show openclaw-gateway --property=MainPID --value 2>/dev/null', {
        timeout: 2000,
      });
      const pid = parseInt(stdout.trim(), 10);
      if (pid > 0) debugInfo.gateway.pid = pid;
    } catch {
      // PID unavailable
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

    // Disk usage
    try {
      const { stdout } = await execAsync("df -h / | tail -1 | awk '{print $2,$3,$4,$5}'", {
        timeout: 3000,
      });
      const parts = stdout.trim().split(/\s+/);
      if (parts.length >= 4) {
        debugInfo.system.disk = {
          total: parts[0],
          used: parts[1],
          available: parts[2],
          percentUsed: parts[3],
        };
      }
    } catch {
      // Disk info unavailable
    }

    // npm version
    try {
      const { stdout } = await execAsync('npm --version 2>/dev/null', {
        timeout: 2000,
      });
      debugInfo.node.npmVersion = stdout.trim();
    } catch {
      // npm version unavailable
    }

    // Config summary — count agents, channels, model overrides
    try {
      const configRaw = await fs.readFile(path.join(OPENCLAW_HOME, 'openclaw.json'), 'utf-8');
      const config = JSON.parse(configRaw);
      const agents = config.agents ? Object.keys(config.agents).length : 0;
      const channels = config.channels ? Object.keys(config.channels) : [];
      const modelOverrides = config.agents
        ? Object.values(config.agents).filter((a: any) => a.model).length
        : 0;
      debugInfo.openclaw.configSummary = { agents, channels, modelOverrides };
    } catch {
      // Config parse failed
    }

    // Recent errors from openclaw log
    try {
      const logPath = path.join(OPENCLAW_HOME, 'logs', 'openclaw.log');
      const logContent = await fs.readFile(logPath, 'utf-8');
      const lines = logContent.split('\n').filter(Boolean);
      const errors: { timestamp: string; message: string }[] = [];
      // Read from end, collect last 10 errors
      for (let i = lines.length - 1; i >= 0 && errors.length < 10; i--) {
        try {
          const entry = JSON.parse(lines[i]);
          if (entry.level === 'error' || entry.level === 50) {
            errors.push({
              timestamp: entry.timestamp || entry.time || '',
              message: entry.msg || entry.message || JSON.stringify(entry).slice(0, 200),
            });
          }
        } catch {
          // Not JSON, check for ERROR keyword
          if (lines[i].toLowerCase().includes('error')) {
            errors.push({ timestamp: '', message: lines[i].slice(0, 200) });
          }
        }
      }
      if (errors.length > 0) debugInfo.recentErrors = errors;
    } catch {
      // Log read failed
    }

    // Service statuses
    try {
      const services = ['openclaw-gateway'];
      const serviceStatuses: { name: string; status: string }[] = [];
      for (const svc of services) {
        try {
          const { stdout } = await execAsync(`systemctl --user is-active ${svc} 2>/dev/null`, { timeout: 2000 });
          serviceStatuses.push({ name: svc, status: stdout.trim() });
        } catch {
          serviceStatuses.push({ name: svc, status: 'unknown' });
        }
      }
      debugInfo.services = serviceStatuses;
    } catch {
      // Service check failed
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
