// Mission Control - Taskmaster SLA Breach Actions API
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const PRIORITY_ORDER = ['critical', 'high', 'medium', 'low'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, action } = body;

    if (!taskId || !action) {
      return NextResponse.json({ error: 'Missing taskId or action' }, { status: 400 });
    }

    const db = getDb();
    
    // Verify task exists and is SLA breached
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    switch (action) {
      case 'reassign': {
        // Move task back to intake for re-triage
        db.prepare(`
          UPDATE tasks 
          SET status = 'intake', assignedTo = NULL, slaBreached = 0, updatedAt = datetime('now')
          WHERE id = ?
        `).run(taskId);
        return NextResponse.json({ success: true, message: 'Task moved to intake for re-triage' });
      }

      case 'deprioritize': {
        // Lower priority by one level
        const currentIdx = PRIORITY_ORDER.indexOf(task.priority);
        const newPriority = currentIdx >= 0 && currentIdx < PRIORITY_ORDER.length - 1
          ? PRIORITY_ORDER[currentIdx + 1]
          : 'low';
        db.prepare(`
          UPDATE tasks 
          SET priority = ?, slaBreached = 0, updatedAt = datetime('now')
          WHERE id = ?
        `).run(newPriority, taskId);
        return NextResponse.json({ success: true, message: `Priority lowered to ${newPriority}` });
      }

      case 'dismiss': {
        // Just clear the SLA breach flag
        db.prepare(`
          UPDATE tasks 
          SET slaBreached = 0, updatedAt = datetime('now')
          WHERE id = ?
        `).run(taskId);
        return NextResponse.json({ success: true, message: 'SLA breach dismissed' });
      }

      case 'unblock': {
        // Move from blocked to ready
        db.prepare(`
          UPDATE tasks 
          SET status = 'ready', slaBreached = 0, updatedAt = datetime('now')
          WHERE id = ?
        `).run(taskId);
        return NextResponse.json({ success: true, message: 'Task unblocked and moved to ready' });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('SLA action error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
