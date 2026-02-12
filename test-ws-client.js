const WebSocket = require('ws');

const ws = new WebSocket('ws://127.0.0.1:18789');
let connected = false;

ws.on('open', () => {
  console.log('WebSocket opened');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('Received:', JSON.stringify(msg, null, 2));
  
  if (msg.type === 'event' && msg.event === 'connect.challenge') {
    console.log('\nSending handshake...');
    ws.send(JSON.stringify({
      type: 'req',
      id: 'connect',
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: 'webchat-ui',
          version: '1.0.0',
          platform: 'web',
          mode: 'webchat'
        },
        role: 'operator',
        scopes: ['operator.read', 'operator.write'],
        auth: { token: process.env.OPENCLAW_GATEWAY_TOKEN || '' }
      }
    }));
  } else if (msg.id === 'connect' && msg.ok) {
    console.log('\nConnected! Requesting status...');
    connected = true;
    ws.send(JSON.stringify({
      type: 'req',
      id: 'status',
      method: 'status',
      params: {}
    }));
  } else if (msg.id === 'status' && msg.ok) {
    console.log('\n=== STATUS PAYLOAD ===');
    console.log(JSON.stringify(msg.payload, null, 2));
    console.log('\n=== AGENTS COUNT:', msg.payload?.agents?.length || 0);
    ws.close();
  }
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err);
});

ws.on('close', () => {
  console.log('\nWebSocket closed');
  process.exit(0);
});

setTimeout(() => {
  if (!connected) {
    console.log('Timeout - no connection');
    ws.close();
    process.exit(1);
  }
}, 10000);
