// Task Activity Logging - Sync with oc-tasks activity log
import { getDb } from './db';
import { v4 as uuidv4 } from 'uuid';

/**
 * Log a task activity event to the task_activity table
 * This keeps Mission Control changes in sync with oc-tasks CLI activity logs
 * 
 * @param taskId Task UUID
 * @param action Action type (created, updated, moved, assigned, dispatched, etc.)
 * @param actor Who performed the action (ui, taskmaster, agent:<id>, etc.)
 * @param oldValue Previous value (for changes)
 * @param newValue New value (for changes)
 */
export function logTaskActivity(
  taskId: string,
  action: string,
  actor: string,
  oldValue?: string | null,
  newValue?: string | null
): void {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO task_activity (id, taskId, action, actor, oldValue, newValue, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      taskId,
      action,
      actor,
      oldValue ?? null,
      newValue ?? null,
      new Date().toISOString()
    );
  } catch (error) {
    // Don't fail the operation if activity logging fails
    console.error('Failed to log task activity:', error);
  }
}

/**
 * Get activity log for a task
 */
export function getTaskActivity(taskId: string): Array<{
  id: string;
  taskId: string;
  action: string;
  actor: string;
  oldValue: string | null;
  newValue: string | null;
  timestamp: string;
}> {
  const db = getDb();
  return db
    .prepare('SELECT * FROM task_activity WHERE taskId = ? ORDER BY timestamp DESC')
    .all(taskId) as any[];
}
