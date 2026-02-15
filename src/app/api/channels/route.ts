// Mission Control - Channels API (Enhanced)
import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';

interface ChannelInfo {
  id: string;
  enabled: boolean;
  mode?: string;
  dmPolicy?: string;
  groupPolicy?: string;
  subChannels: {
    id: string;
    type: string; // 'channel' | 'dm'
    allow: boolean;
    requireMention: boolean;
    agentId?: string; // from bindings
    agentName?: string;
  }[];
  config: Record<string, unknown>; // raw config for display
}

interface Binding {
  agentId: string;
  match: {
    channel: string;
    accountId?: string;
    peer?: {
      kind: string;
      id: string;
    };
  };
}

export async function GET() {
  try {
    const configPath = join(homedir(), '.openclaw', 'openclaw.json');
    const configData = await readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);

    const channelsObj = config.channels || {};
    const bindings: Binding[] = config.bindings || [];
    const agentsList = config.agents?.list || [];
    
    // Build agent name map
    const agentNames = new Map<string, string>();
    for (const agent of agentsList) {
      agentNames.set(agent.id, agent.name || agent.id);
    }

    // Transform channels
    const channels: ChannelInfo[] = Object.entries(channelsObj).map(([id, channelConfig]: [string, any]) => {
      // Get bindings for this channel
      const channelBindings = bindings.filter(b => b.match.channel === id);
      
      // Get sub-channels (if any)
      const subChannelsObj = channelConfig.channels || {};
      const subChannels = Object.entries(subChannelsObj).map(([subId, subConfig]: [string, any]) => {
        // Find binding for this sub-channel
        const binding = channelBindings.find(b => 
          b.match.peer?.id === subId
        );
        
        return {
          id: subId,
          type: 'channel',
          allow: subConfig.allow ?? true,
          requireMention: subConfig.requireMention ?? false,
          agentId: binding?.agentId,
          agentName: binding?.agentId ? agentNames.get(binding.agentId) : undefined,
        };
      });
      
      // Add DM bindings that don't have sub-channel entries
      for (const binding of channelBindings) {
        if (binding.match.peer?.kind === 'dm' && !subChannels.find(sc => sc.id === binding.match.peer?.id)) {
          subChannels.push({
            id: binding.match.peer.id,
            type: 'dm',
            allow: true,
            requireMention: false,
            agentId: binding.agentId,
            agentName: binding.agentId ? agentNames.get(binding.agentId) : undefined,
          });
        }
        // Add wildcard bindings (accountId: "*")
        if (binding.match.accountId === '*' && !subChannels.find(sc => sc.id === `*`)) {
          subChannels.push({
            id: '*',
            type: 'wildcard',
            allow: true,
            requireMention: false,
            agentId: binding.agentId,
            agentName: binding.agentId ? agentNames.get(binding.agentId) : undefined,
          });
        }
      }

      // Sanitize config (remove sensitive tokens)
      const safeConfig: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(channelConfig)) {
        if (['channels', 'token', 'apiKey', 'secret', 'password', 'webhook'].some(s => key.toLowerCase().includes(s))) continue;
        safeConfig[key] = value;
      }

      return {
        id,
        enabled: channelConfig.enabled ?? true,
        mode: channelConfig.mode,
        dmPolicy: channelConfig.dm?.policy || channelConfig.dmPolicy,
        groupPolicy: channelConfig.groupPolicy,
        subChannels,
        config: safeConfig,
      };
    });

    // Also return bindings summary
    const routingSummary = bindings.map(b => ({
      agentId: b.agentId,
      agentName: agentNames.get(b.agentId) || b.agentId,
      channel: b.match.channel,
      target: b.match.accountId === '*' 
        ? 'all' 
        : b.match.peer 
          ? `${b.match.peer.kind}:${b.match.peer.id}` 
          : 'unknown',
    }));

    return NextResponse.json({ channels, routing: routingSummary });
  } catch (error) {
    console.error('Channels API error:', error);
    return NextResponse.json({
      channels: [],
      routing: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
