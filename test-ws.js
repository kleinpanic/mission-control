const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3333/api/gateway/ws');

ws.on('open', function open() {
  console.log('Connected to Mission Control Proxy');
  // Send connect request with token
  ws.send(JSON.stringify({
    type: 'req',
    method: 'connect',
    id: '1',
    params: {
      auth: {
        token: 'a1231426aa7782bf8e509358900c68e5c2995c9dcfe06cdc'
      }
    }
  }));
});

ws.on('message', function incoming(data) {
  console.log('Received:', data.toString());
});

ws.on('error', function error(err) {
  console.error('Error:', err);
});

setTimeout(() => {
  console.log('Closing...');
  ws.close();
  process.exit(0);
}, 60000);
