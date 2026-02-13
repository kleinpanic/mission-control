// Mission Control - Tasks API (shared database with oc-tasks)
import { NextRequest, NextResponse } from 'next/server';
import { createTask, getTasks, updateTask, deleteTask } from '@/lib/db';
import { TaskStatus, TaskPriority, TaskType } from '@/types';

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
    const { title, description, status, priority, type, assignedTo, tags, metadata,
            complexity, danger, list, dueDate, estimatedMinutes, parentId, projectId } = body;

    if (!title) {
      return NextResponse.json(
        { error: 'Missing required field: title' },
        { status: 400 }
      );
    }

    const task = createTask({
      title,
      description,
      status: (status || 'intake') as TaskStatus,
      priority: (priority || 'medium') as TaskPriority,
      type: (type || 'manual') as TaskType,
      complexity: complexity || 'simple',
      danger: danger || 'safe',
      assignedTo: assignedTo || null,
      list: list || 'agents',
      tags: tags || [],
      metadata,
      dueDate: dueDate || null,
      estimatedMinutes: estimatedMinutes || null,
      parentId: parentId || null,
      projectId: projectId || null,
    });

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
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing task id' },
        { status: 400 }
      );
    }

    const task = updateTask(id, updates);

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
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
