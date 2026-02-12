const WebSocket = require('ws');

const ws = new WebSocket('ws://127.0.0.1:18789');

ws.on('open', () => {
  console.log('Connected to gateway');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  if (msg.type === 'event' && msg.event === 'connect.challenge') {
    console.log('Sending handshake...');
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
        auth: { token: 'c1932f373d2641c221084082398921dcbcf863ca783d807c' }
      }
    }));
  } else if (msg.id === 'connect' && msg.ok) {
    console.log('Connected successfully, requesting usage.cost...');
    ws.send(JSON.stringify({
      type: 'req',
      id: 'cost',
      method: 'usage.cost',
      params: {}
    }));
  } else if (msg.id === 'cost') {
    console.log('\n=== USAGE.COST RESPONSE ===');
    console.log(JSON.stringify(msg, null, 2));
    ws.close();
  } else {
    console.log('Received:', msg);
  }
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

ws.on('close', () => {
  console.log('\nConnection closed');
  process.exit(0);
});

setTimeout(() => {
  console.log('Timeout - closing');
  ws.close();
  process.exit(1);
}, 10000);
