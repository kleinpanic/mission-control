// Mission Control - Gateway API Proxy
import { NextRequest, NextResponse } from 'next/server';
import { getGatewayClient } from '@/lib/gateway';

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

    const client = getGatewayClient();
    
    // Ensure connected
    if (!client) {
      await client.connect();
    }

    const result = await client.send({
      id: crypto.randomUUID(),
      method,
      params,
    });

    if (result.error) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ result: result.result });
  } catch (error) {
    console.error('Gateway API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
