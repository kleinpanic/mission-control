// Mission Control - Rate Limits API
// Reads auth-profiles.json for each agent to find cooldown/rate-limit state
import { NextResponse } from 'next/server';
import { readFile, readdir } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';

interface ProviderCooldown {
  provider: string;
  cooldownUntil: number;
  active: boolean;
  remainingMs: number;
  remainingHuman: string;
  authMode?: string; // "oauth" | "api" | "token" | "local" | "unknown"
}

interface AgentRateLimits {
  agentId: string;
  agentName: string;
  cooldowns: ProviderCooldown[];
  hasActiveCooldown: boolean;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'expired';
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${Math.floor(ms / 1000)}s`;
}

export async function GET() {
  try {
    const agentsDir = join(homedir(), '.openclaw', 'agents');
    const configPath = join(homedir(), '.openclaw', 'openclaw.json');
    
    // Get agent names and auth modes from config
    const agentNames = new Map<string, string>();
    const providerAuthModes = new Map<string, string>();
    try {
      const config = JSON.parse(await readFile(configPath, 'utf-8'));
      for (const agent of config.agents?.list || []) {
        agentNames.set(agent.id, agent.name || agent.id);
      }
      // Extract auth modes from auth.profiles
      for (const [, profile] of Object.entries(config.auth?.profiles || {})) {
        const p = profile as any;
        if (p.provider && p.mode) {
          providerAuthModes.set(p.provider, p.mode);
        }
      }
      // Infer from model providers
      for (const [providerId, pc] of Object.entries(config.models?.providers || {})) {
        if (providerAuthModes.has(providerId)) continue;
        const conf = pc as any;
        if (conf.baseUrl?.includes('localhost') || conf.baseUrl?.includes('127.0.0.1')) {
          providerAuthModes.set(providerId, 'local');
        } else if (conf.apiKey) {
          providerAuthModes.set(providerId, 'api');
        }
      }
    } catch {}

    // Read all agent directories
    let agentDirs: string[] = [];
    try {
      agentDirs = await readdir(agentsDir);
    } catch {
      return NextResponse.json({ agents: [], error: 'Cannot read agents directory' });
    }

    const now = Date.now();
    const results: AgentRateLimits[] = [];

    for (const agentId of agentDirs) {
      const profilePath = join(agentsDir, agentId, 'agent', 'auth-profiles.json');
      try {
        const data = JSON.parse(await readFile(profilePath, 'utf-8'));
        const usageStats = data.usageStats || {};
        const cooldowns: ProviderCooldown[] = [];

        for (const [providerKey, value] of Object.entries(usageStats)) {
          let cooldownUntil: number | null = null;

          if (typeof value === 'object' && value !== null && 'cooldownUntil' in (value as any)) {
            cooldownUntil = (value as any).cooldownUntil;
          } else if (typeof value === 'number' && value > 1700000000000) {
            // Direct timestamp value
            cooldownUntil = value;
          }

          if (cooldownUntil) {
            const active = cooldownUntil > now;
            const remainingMs = Math.max(0, cooldownUntil - now);
            // Extract base provider name for auth mode lookup
            const baseProvider = providerKey.split(':')[0];
            cooldowns.push({
              provider: providerKey.replace(/:default$/, '').replace(/:manual$/, ''),
              cooldownUntil,
              active,
              remainingMs,
              remainingHuman: formatRemaining(remainingMs),
              authMode: providerAuthModes.get(baseProvider) || providerAuthModes.get(providerKey) || 'unknown',
            });
          }
        }

        // Sort: active first, then by remaining time desc
        cooldowns.sort((a, b) => {
          if (a.active !== b.active) return a.active ? -1 : 1;
          return b.remainingMs - a.remainingMs;
        });

        results.push({
          agentId,
          agentName: agentNames.get(agentId) || agentId,
          cooldowns,
          hasActiveCooldown: cooldowns.some(c => c.active),
        });
      } catch {
        // Skip agents without auth-profiles
      }
    }

    // Sort: agents with active cooldowns first
    results.sort((a, b) => {
      if (a.hasActiveCooldown !== b.hasActiveCooldown) return a.hasActiveCooldown ? -1 : 1;
      return a.agentId.localeCompare(b.agentId);
    });

    return NextResponse.json({
      agents: results,
      timestamp: now,
      summary: {
        totalAgents: results.length,
        rateLimited: results.filter(r => r.hasActiveCooldown).length,
      },
    });
  } catch (error) {
    console.error('Rate limits API error:', error);
    return NextResponse.json({
      agents: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
