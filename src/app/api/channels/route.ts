// Mission Control - Channels API
import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';

export async function GET() {
  try {
    // Read config file directly (faster and cleaner than CLI)
    const configPath = join(homedir(), '.openclaw', 'openclaw.json');
    const configData = await readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);

    const channelsObj = config.channels || {};
    
    // Transform to array format
    const channels = Object.entries(channelsObj).map(([id, channelConfig]: [string, any]) => ({
      id,
      type: channelConfig.type || 'unknown',
      enabled: channelConfig.enabled ?? true,
      name: channelConfig.name || id,
    }));

    return NextResponse.json({ channels });
  } catch (error) {
    console.error('Channels API error:', error);
    return NextResponse.json({
      channels: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
