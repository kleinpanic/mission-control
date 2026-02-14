const WebSocket = require('ws');

const ws = new WebSocket('ws://127.0.0.1:18789');

ws.on('open', function open() {
  console.log('connected');
});

ws.on('message', function incoming(data) {
  const msg = JSON.parse(data);
  console.log('received:', JSON.stringify(msg, null, 2));
  
  if (msg.event === 'connect.challenge') {
    ws.send(JSON.stringify({
      type: 'req',
      id: 'connect',
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: { id: 'test', version: '1.0.0', platform: 'node', mode: 'cli' },
        role: 'operator',
        scopes: ['operator.read'],
        auth: { token: 'c1932f373d2641c221084082398921dcbcf863ca783d807c' }
      }
    }));
  } else if (msg.type === 'res' && msg.id === 'connect') {
    ws.send(JSON.stringify({
      type: 'req',
      id: 'cost',
      method: 'usage.cost',
      params: {}
    }));
  } else if (msg.id === 'cost') {
    process.exit(0);
  }
});
