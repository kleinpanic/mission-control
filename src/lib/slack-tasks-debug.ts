// Debug version of Slack tasks integration with enhanced logging

import { createTask } from './db';

const MAIN_CHANNEL_ID = 'C0ACZ4ZF8PR'; // #main-openclaw

export function parseTaskFromMessage(text: string): { title: string; description?: string } | null {
  const trimmed = text.trim();
  
  if (trimmed.length < 5) return null;
  
  const taskRegex = /^(fix|update|create|add|delete|check|implement|investigate|deploy|revert|refactor|todo:|task:)\s+/i;
  
  if (taskRegex.test(trimmed)) {
    return {
      title: trimmed.replace(/^(todo:|task:)\s+/i, ''),
    };
  }
  
  if (trimmed.endsWith('!') && trimmed.split(' ').length < 10) {
    return { title: trimmed };
  }

  return null;
}

export async function handleSlackMessage(payload: any) {
  console.log('[SlackTasks] Received payload:', JSON.stringify(payload, null, 2));
  console.log('[SlackTasks] Payload keys:', Object.keys(payload));
  console.log('[SlackTasks] payload.to:', payload.to);
  console.log('[SlackTasks] payload.channel:', payload.channel);
  console.log('[SlackTasks] payload.groupChannel:', payload.groupChannel);
  
  // Try multiple channel detection methods
  const isMainChannel = 
    payload.to === `channel:${MAIN_CHANNEL_ID}` ||
    payload.channel === MAIN_CHANNEL_ID ||
    payload.groupChannel === '#main-openclaw' ||
    payload.channel?.id === MAIN_CHANNEL_ID;
  
  if (!isMainChannel) {
    console.log('[SlackTasks] Not main channel, skipping');
    return;
  }

  const text = payload.text || payload.message || payload.content;
  console.log('[SlackTasks] Message text:', text);
  
  if (!text) {
    console.log('[SlackTasks] No text found in payload');
    return;
  }

  const taskData = parseTaskFromMessage(text);
  console.log('[SlackTasks] Parse result:', taskData);
  
  if (taskData) {
    console.log(`[SlackTasks] ✅ Creating task: "${taskData.title}"`);
    
    try {
      const task = await createTask({
        title: taskData.title,
        description: `Source: Slack #main-openclaw\n\nOriginal: ${text}`,
        status: 'intake',
        priority: 'critical',
        type: 'slack' as any,
        assignedTo: null,
        list: 'agents',
        tags: ['slack', 'auto-created'],
        metadata: {
          sourceChannel: payload.to || payload.channel,
          messageId: payload.id,
          timestamp: new Date().toISOString(),
        }
      });
      
      console.log('[SlackTasks] ✅ Task created:', task.id);
      return task;
    } catch (error) {
      console.error('[SlackTasks] ❌ Failed to create task:', error);
      throw error;
    }
  } else {
    console.log('[SlackTasks] Message does not match task pattern');
  }
}
