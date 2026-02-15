// Mission Control - Channels API
import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET() {
  try {
    // Get channels from gateway config
    const { stdout } = await execAsync(
      'openclaw config get | jq -r \'.channels | to_entries | map({id: .key, type: .value.type, enabled: (.value.enabled // true)}) | .[]\'',
      { timeout: 5000 }
    );

    if (!stdout || stdout.trim() === '') {
      return NextResponse.json({ channels: [] });
    }

    // Parse JSON lines
    const channels = stdout
      .trim()
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return NextResponse.json({ channels });
  } catch (error) {
    console.error('Channels API error:', error);
    return NextResponse.json({
      channels: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
