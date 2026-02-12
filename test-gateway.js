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
          id: 'mission-control-test', 
          version: '1.0.0', 
          platform: 'web', 
          mode: 'webchat' 
        },
        role: 'operator',
        scopes: ['operator.read', 'operator.write'],
        auth: { token: '' }
      }
    }));
  } else if (msg.id === 'connect' && msg.ok) {
    console.log('Connected successfully, requesting status...');
    ws.send(JSON.stringify({
      type: 'req',
      id: 'status',
      method: 'status',
      params: {}
    }));
  } else if (msg.id === 'status') {
    console.log('\n=== STATUS RESPONSE ===');
    console.log(JSON.stringify(msg.payload, null, 2));
    console.log('\n=== AGENTS ===');
    if (msg.payload.agents) {
      msg.payload.agents.forEach(agent => {
        console.log(`\nAgent: ${agent.name || agent.id}`);
        console.log(`  lastActivity: ${agent.lastActivity}`);
        console.log(`  lastActivityAge: ${agent.lastActivityAge}`);
      });
    }
    console.log('\n=== HEARTBEAT ===');
    console.log(JSON.stringify(msg.payload.heartbeat, null, 2));
    ws.close();
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
