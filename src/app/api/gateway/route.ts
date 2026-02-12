// Mission Control - Gateway API Proxy
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { method, params } = body;

    if (!method) {
      return NextResponse.json(
        { error: 'Missing method parameter' },
        { status: 400 }
      );
    }

    // For server-side, we'll make HTTP requests to gateway instead of WebSocket
    // This is simpler for API routes
    const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789';
    const httpUrl = gatewayUrl.replace('ws://', 'http://').replace('wss://', 'https://');
    const token = process.env.OPENCLAW_GATEWAY_TOKEN || '';

    const response = await fetch(`${httpUrl}/api/v1/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ method, params }),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: error || 'Gateway request failed' },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json({ result });
  } catch (error) {
    console.error('Gateway API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
