// Mission Control - Shared Codexbar Cost Cache
// Deduplicates expensive codexbar calls across /api/costs and /api/costs/history.

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const CODEXBAR = '/home/broklein/.local/bin/codexbar';
const EXEC_OPTS = {
  env: {
    ...process.env,
    HOME: process.env.HOME || '/home/broklein',
    PATH: `/home/broklein/.local/bin:${process.env.PATH || '/usr/local/bin:/usr/bin:/bin'}`,
  },
  maxBuffer: 10 * 1024 * 1024,
};

// --- Text summary (fast: ~5s) ---
export interface ProviderTextSummary {
  provider: string;
  today: number;
  todayTokens: string;
  month: number;
  monthTokens: string;
}

let textCache: { data: ProviderTextSummary[]; time: number } | null = null;
const TEXT_TTL = 120_000; // 2 minutes
let textInflight: Promise<ProviderTextSummary[]> | null = null;

/**
 * Parse multi-provider text output from `codexbar cost --provider all`.
 */
export function parseMultiProviderText(text: string): ProviderTextSummary[] {
  const providers: ProviderTextSummary[] = [];
  const blocks = text.split(/\n(?=\w+ Cost )/);

  for (const block of blocks) {
    const headerMatch = block.match(/^(\w+)\s+Cost/);
    if (!headerMatch) continue;

    const provider = headerMatch[1].toLowerCase();
    let today = 0;
    let todayTokens = '';
    let month = 0;
    let monthTokens = '';

    const todayMatch = block.match(/Today:\s*\$([0-9.]+)\s*·\s*(.+)/);
    if (todayMatch) {
      today = parseFloat(todayMatch[1]);
      todayTokens = todayMatch[2].trim();
    } else {
      const todayDashMatch = block.match(/Today:\s*—\s*·\s*(.+)/);
      if (todayDashMatch) todayTokens = todayDashMatch[1].trim();
    }

    const monthMatch = block.match(/Last 30 days:\s*\$([0-9.]+)\s*·\s*(.+)/);
    if (monthMatch) {
      month = parseFloat(monthMatch[1]);
      monthTokens = monthMatch[2].trim();
    }

    providers.push({ provider, today, todayTokens, month, monthTokens });
  }

  return providers;
}

export async function getCostTextSummary(): Promise<ProviderTextSummary[]> {
  const now = Date.now();
  if (textCache && now - textCache.time < TEXT_TTL) return textCache.data;
  if (textInflight) return textInflight;

  textInflight = (async () => {
    try {
      // Use spawn-style exec with explicit shell and stderr redirect
      const result = await new Promise<string>((resolve, reject) => {
        exec(
          `${CODEXBAR} cost --provider all 2>/dev/null`,
          { ...EXEC_OPTS, timeout: 12000, shell: '/bin/bash' },
          (error, stdout, _stderr) => {
            // Accept stdout even if exit code is non-zero (e.g. some providers skipped)
            if (stdout && stdout.trim()) {
              resolve(stdout);
            } else if (error) {
              reject(error);
            } else {
              resolve('');
            }
          }
        );
      });

      const data = parseMultiProviderText(result);
      if (data.length > 0) {
        textCache = { data, time: Date.now() };
      }
      return data;
    } catch (e: any) {
      console.warn('[costCache] Text fetch failed:', e.message?.slice(0, 100));
      return textCache?.data || [];
    } finally {
      textInflight = null;
    }
  })();

  return textInflight;
}

// --- JSON detail cache (slow: ~12s) ---
let jsonCache: { data: any[]; time: number } | null = null;
const JSON_TTL = 5 * 60_000; // 5 minutes
let jsonInflight: Promise<any[]> | null = null;

export async function getCostJsonProviders(): Promise<any[]> {
  const now = Date.now();
  if (jsonCache && now - jsonCache.time < JSON_TTL) return jsonCache.data;
  if (jsonInflight) return jsonInflight;

  jsonInflight = (async () => {
    try {
      const result = await new Promise<string>((resolve, reject) => {
        exec(
          `${CODEXBAR} cost --format json --provider all 2>/dev/null`,
          { ...EXEC_OPTS, timeout: 15000, shell: '/bin/bash' },
          (error, stdout, _stderr) => {
            if (stdout && stdout.trim() && stdout.trim() !== '[]') {
              resolve(stdout);
            } else if (error) {
              reject(error);
            } else {
              resolve('[]');
            }
          }
        );
      });

      const data = JSON.parse(result.trim());
      if (Array.isArray(data) && data.length > 0) {
        jsonCache = { data, time: Date.now() };
      }
      return data;
    } catch (e: any) {
      console.warn('[costCache] JSON fetch failed:', e.message?.slice(0, 100));
      return jsonCache?.data || [];
    } finally {
      jsonInflight = null;
    }
  })();

  return jsonInflight;
}

export function invalidateCostCache(): void {
  textCache = null;
  jsonCache = null;
}
