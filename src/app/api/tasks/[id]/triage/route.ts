// Mission Control - Task Triage API
// Used by taskmaster to triage intake tasks
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { logTaskActivity } from '@/lib/taskActivity';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { priority, complexity, danger, assignedTo, recommendedModel } = await req.json();

    const db = getDb();

    // Get old task for activity logging
    const oldTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
    if (!oldTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];

    if (priority) {
      updates.push('priority = ?');
      values.push(priority);
      if (priority !== oldTask.priority) {
        logTaskActivity(id, 'triaged', 'taskmaster', oldTask.priority, priority);
      }
    }

    if (complexity) {
      updates.push('complexity = ?');
      values.push(complexity);
      if (complexity !== oldTask.complexity) {
        logTaskActivity(id, 'triaged', 'taskmaster', oldTask.complexity, complexity);
      }
    }

    if (danger) {
      updates.push('danger = ?');
      values.push(danger);
      if (danger !== oldTask.danger) {
        logTaskActivity(id, 'triaged', 'taskmaster', oldTask.danger, danger);
      }
    }

    if (assignedTo !== undefined) {
      updates.push('assignedTo = ?');
      values.push(assignedTo);
      if (assignedTo !== oldTask.assignedTo) {
        logTaskActivity(id, 'assigned', 'taskmaster', oldTask.assignedTo, assignedTo);
      }
    }

    if (recommendedModel) {
      updates.push('recommendedModel = ?');
      values.push(recommendedModel);
    }

    if (updates.length === 0) {
      return NextResponse.json({ task: oldTask });
    }

    updates.push('updatedAt = ?');
    values.push(new Date().toISOString());

    values.push(id);

    db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;

    return NextResponse.json({ task: updatedTask });
  } catch (error) {
    console.error('Triage error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
