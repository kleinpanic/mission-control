// Mission Control - Gateway WebSocket Proxy
// Proxies browser WebSocket connections to the OpenClaw Gateway
// This allows the frontend to connect without exposing gateway credentials

import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const upgradeHeader = request.headers.get('upgrade');
  
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected WebSocket', { status: 426 });
  }

  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789';
  const token = process.env.OPENCLAW_GATEWAY_TOKEN || '';

  // Next.js doesn't natively support WebSocket upgrades in API routes
  // We need to use the underlying Node.js server
  // For now, return instructions to connect directly
  return new Response(
    JSON.stringify({
      error: 'WebSocket proxy not yet implemented',
      workaround: 'Set NEXT_PUBLIC_OPENCLAW_GATEWAY_URL in .env.local to connect directly',
      gatewayUrl: gatewayUrl.replace(token + '@', ''), // Don't leak token
    }),
    { 
      status: 501,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
