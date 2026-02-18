// Mission Control - Shared OpenClaw Status Cache
// Deduplicates `openclaw status --json` calls across API routes.
// Single in-flight promise prevents thundering herd on concurrent requests.

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

let cache: { data: any; time: number } | null = null;
const TTL = 30_000; // 30 seconds — longer cache, less CLI overhead

// Dedup: only one CLI invocation at a time
let inflight: Promise<any> | null = null;

const EXEC_ENV = {
  ...process.env,
  PATH: `/home/broklein/.local/bin:${process.env.PATH || '/usr/local/bin:/usr/bin:/bin'}`,
  HOME: process.env.HOME || '/home/broklein',
};

/**
 * Returns parsed `openclaw status --json` output.
 * Cached for 10s with in-flight deduplication.
 */
export async function getOpenClawStatus(): Promise<any> {
  const now = Date.now();
  if (cache && now - cache.time < TTL) return cache.data;

  // If another caller is already fetching, reuse that promise
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const { stdout } = await execAsync(
        'openclaw status --json 2>/dev/null',
        { maxBuffer: 10 * 1024 * 1024, timeout: 8000, env: EXEC_ENV }
      );

      // Skip plugin log lines (e.g. "[plugins] ...")
      const lines = stdout.split('\n');
      const jsonStart = lines.findIndex(l => l.trim().startsWith('{'));
      if (jsonStart === -1) throw new Error('No JSON found in openclaw status output');

      const data = JSON.parse(lines.slice(jsonStart).join('\n'));
      cache = { data, time: Date.now() };
      return data;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/**
 * Invalidate the cache (e.g. after a mutation).
 */
export function invalidateStatusCache(): void {
  cache = null;
}

/**
 * Returns stale cache immediately (if available), refreshes in background.
 * Use for initial page loads where stale data > no data.
 */
export function getOpenClawStatusStaleWhileRevalidate(): { data: any | null; fresh: Promise<any> } {
  const stale = cache?.data || null;
  const fresh = getOpenClawStatus();
  return { data: stale, fresh };
}

// Pre-warm on module load (server start)
if (typeof globalThis !== 'undefined') {
  getOpenClawStatus().catch(() => {});
}
