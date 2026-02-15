// Use absolute paths to avoid alias issues in simple tsx run
const { handleSlackMessage } = require('./src/lib/slack-tasks');

async function test() {
  console.log('Testing Slack task detection...');
  const payload = {
    to: 'channel:C0ACZ4ZF8PR',
    text: 'Fix the header navigation!',
    origin: { from: 'slack:U0AA23ZC2KD' },
    id: 'test-msg-1',
    ts: new Date().toISOString()
  };

  const task = await handleSlackMessage(payload);
  if (task) {
    console.log('Task created successfully:', task.title);
    console.log('Task ID:', task.id);
  } else {
    console.log('No task detected.');
  }
}

test().catch(console.error);
