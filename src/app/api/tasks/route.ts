// Mission Control - Tasks API (shared database with oc-tasks)
import { NextRequest, NextResponse } from 'next/server';
import { createTask, getTasks, updateTask, deleteTask } from '@/lib/db';
import { TaskStatus, TaskPriority, TaskType } from '@/types';
import { logTaskActivity } from '@/lib/taskActivity';
import { CreateTaskSchema, UpdateTaskSchema, validateRequest } from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const assignedTo = searchParams.get('assignedTo');
    const type = searchParams.get('type') as TaskType | null;
    const priority = searchParams.get('priority') as TaskPriority | null;
    const list = searchParams.get('list');
    const tag = searchParams.get('tag');
    const backburnered = searchParams.get('backburnered');
    const sort = searchParams.get('sort');

    const filters: any = {};

    // Support comma-separated statuses
    if (status) {
      const statuses = status.split(',') as TaskStatus[];
      filters.status = statuses.length === 1 ? statuses[0] : statuses;
    }
    if (assignedTo) filters.assignedTo = assignedTo;
    if (type) filters.type = type;
    if (priority) filters.priority = priority;
    if (list) filters.list = list;
    if (tag) filters.tag = tag;
    if (backburnered !== null) filters.backburnered = backburnered === 'true';
    if (sort) filters.sort = sort;

    const tasks = getTasks(filters);
    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('Tasks GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = validateRequest(CreateTaskSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.message, issues: validation.error.issues },
        { status: 400 }
      );
    }

    const data = validation.data;
    const task = createTask({
      title: data.title,
      description: data.description || '',
      status: data.status as TaskStatus,
      priority: data.priority as TaskPriority,
      type: data.type as TaskType,
      complexity: data.complexity,
      danger: data.danger,
      assignedTo: data.assignedTo || null,
      list: data.list,
      tags: data.tags,
      metadata: data.metadata,
      dueDate: data.dueDate || null,
      estimatedMinutes: data.estimatedMinutes || null,
      parentId: data.parentId || null,
      projectId: data.projectId || null,
    });

    // Log creation activity
    logTaskActivity(task.id, 'created', 'ui', null, task.title);

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error('Tasks POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = validateRequest(UpdateTaskSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.message, issues: validation.error.issues },
        { status: 400 }
      );
    }

    const { id, ...updates } = validation.data;

    // Get old task for activity logging
    const oldTasks = getTasks({ status: undefined as any });
    const oldTask = oldTasks.find(t => t.id === id);
    
    if (!oldTask) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    const task = updateTask(id, updates);

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Log significant changes to activity table (sync with oc-tasks)
    if (updates.status && updates.status !== oldTask.status) {
      logTaskActivity(id, 'moved', 'ui', oldTask.status, updates.status);
    }
    if (updates.assignedTo !== undefined && updates.assignedTo !== oldTask.assignedTo) {
      logTaskActivity(id, 'assigned', 'ui', oldTask.assignedTo, updates.assignedTo);
    }
    if (updates.priority && updates.priority !== oldTask.priority) {
      logTaskActivity(id, 'updated', 'ui', oldTask.priority, updates.priority);
    }
    if (updates.title && updates.title !== oldTask.title) {
      logTaskActivity(id, 'updated', 'ui', oldTask.title, updates.title);
    }

    return NextResponse.json({ task });
  } catch (error) {
    console.error('Tasks PATCH error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing task id' },
        { status: 400 }
      );
    }

    const success = deleteTask(id);

    if (!success) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Tasks DELETE error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
