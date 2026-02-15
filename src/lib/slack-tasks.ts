// Mission Control - Slack to Kanban integration
import { createTask } from './db';
import { TaskType, TaskPriority } from '@/types';

const MAIN_CHANNEL_ID = 'C0ACZ4ZF8PR'; // #main-openclaw

/**
 * Checks if a message text looks like a task.
 * Simple regex for now: starts with an imperative verb or contains specific keywords.
 */
export function parseTaskFromMessage(text: string): { title: string; description?: string } | null {
  const trimmed = text.trim();
  
  // Ignore very short messages
  if (trimmed.length < 5) return null;
  
  // Patterns for tasks
  // 1. "Fix/Update/Create/Add/Delete/Check ..."
  // 2. "TODO: ..."
  // 3. "Task: ..."
  const taskRegex = /^(fix|update|create|add|delete|check|implement|investigate|deploy|revert|refactor|todo:|task:)\s+/i;
  
  if (taskRegex.test(trimmed)) {
    return {
      title: trimmed.replace(/^(todo:|task:)\s+/i, ''),
    };
  }
  
  // If it ends with "!", it might be a command
  if (trimmed.endsWith('!') && trimmed.split(' ').length < 10) {
    return { title: trimmed };
  }

  return null;
}

/**
 * Handles an incoming message from Slack.
 */
export async function handleSlackMessage(payload: any) {
  // Only listen to #main-openclaw
  if (payload.to !== `channel:${MAIN_CHANNEL_ID}` && payload.groupChannel !== '#main-openclaw') {
    return;
  }

  const text = payload.text || payload.message;
  if (!text) return;

  const taskData = parseTaskFromMessage(text);
  if (taskData) {
    console.log(`[SlackTasks] Detected task in Slack: "${taskData.title}"`);
    
    try {
      const task = createTask({
        title: taskData.title,
        description: `Source: Slack message from ${payload.origin?.from || 'unknown'}\n\nOriginal text: ${text}`,
        status: 'intake',
        priority: 'critical', // Priority 0 as requested (mapped to critical)
        type: 'slack' as any,
        assignedTo: null,
        list: 'agents',
        tags: ['slack', 'auto-created'],
        metadata: {
          sourceChannel: payload.to,
          messageId: payload.id,
          timestamp: payload.ts || new Date().toISOString(),
          rawPayload: payload
        }
      });
      
      console.log(`[SlackTasks] Created task ${task.id}`);
      return task;
    } catch (error) {
      console.error('[SlackTasks] Failed to create task:', error);
    }
  }
}
