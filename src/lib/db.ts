import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';
import { Task, TaskStatus, TaskPriority, TaskType } from '../types';
import { broadcastToClients } from '../../server';

const DB_PATH = process.env.TASKS_DB_PATH || join(homedir(), '.openclaw', 'tasks.db');

let db: Database.Database;

try {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  // console.log(`[DB] Connected to ${DB_PATH}`);
} catch (error) {
  console.error(`[DB] Failed to connect to ${DB_PATH}:`, error);
  throw error;
}

function broadcast(event: string, data: unknown) {
  try {
    broadcastToClients(event, data);
  } catch (error) {
    console.error(`[DB] Failed to broadcast ${event}:`, error);
  }
}

export function getDb() {
  return db;
}

export function getTask(id: string): Task | null {
  return getTaskById(id);
}

export function closeDb() {
  db.close();
}

export function getTasks(filters: {
  status?: TaskStatus | TaskStatus[];
  assignedTo?: string;
  type?: TaskType;
  priority?: TaskPriority;
  list?: string | string[];
  tag?: string;
  backburnered?: boolean;
  sort?: string;
} = {}): Task[] {
  let query = 'SELECT * FROM tasks WHERE 1=1';
  const params: (string | number | null)[] = [];

  if (filters.status) {
    if (Array.isArray(filters.status)) {
      query += ` AND status IN (${filters.status.map(() => '?').join(',')})`;
      params.push(...filters.status);
    } else {
      query += ' AND status = ?';
      params.push(filters.status);
    }
  }

  if (filters.assignedTo) {
    query += ' AND assignedTo = ?';
    params.push(filters.assignedTo);
  }

  if (filters.type) {
    query += ' AND type = ?';
    params.push(filters.type);
  }

  if (filters.priority) {
    query += ' AND priority = ?';
    params.push(filters.priority);
  }

  if (filters.list) {
    if (Array.isArray(filters.list)) {
      query += ` AND list IN (${filters.list.map(() => '?').join(',')})`;
      params.push(...filters.list);
    } else {
      query += ' AND list = ?';
      params.push(filters.list);
    }
  }

  if (filters.tag) {
    query += ' AND tags LIKE ?';
    params.push(`%${filters.tag}%`);
  }

  if (filters.backburnered !== undefined) {
    query += ' AND backburnered = ?';
    params.push(filters.backburnered ? 1 : 0);
  }

  if (filters.sort) {
    const [field, direction] = filters.sort.split(':');
    const validFields = ['createdAt', 'updatedAt', 'priority', 'status', 'title'];
    if (validFields.includes(field)) {
      query += ` ORDER BY ${field} ${direction === 'desc' ? 'DESC' : 'ASC'}`;
    } else {
      query += ' ORDER BY updatedAt DESC';
    }
  } else {
    query += ' ORDER BY updatedAt DESC';
  }

  const rows = db.prepare(query).all(...params) as Record<string, unknown>[];
  return rows.map(rowToTask);
}

export function getTaskById(id: string): Task | null {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToTask(row) : null;
}

export function createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'statusChangedAt'>): Task {
  const id = Math.random().toString(36).substring(2, 11);
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO tasks (
      id, title, description, status, priority, type, complexity, danger,
      assignedTo, list, tags, metadata, dueDate, estimatedMinutes,
      parentId, projectId, createdAt, updatedAt, statusChangedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    task.title,
    task.description || '',
    task.status || 'todo',
    task.priority || 'medium',
    task.type || 'task',
    task.complexity || 1,
    task.danger || 1,
    task.assignedTo || null,
    task.list || 'shared',
    JSON.stringify(task.tags || []),
    JSON.stringify(task.metadata || {}),
    task.dueDate || null,
    task.estimatedMinutes || null,
    task.parentId || null,
    task.projectId || null,
    now,
    now,
    now
  );

  const newTask = getTaskById(id)!;
  broadcast('task', { action: 'create', task: newTask });
  return newTask;
}

export function updateTask(id: string, updates: Partial<Task>): Task | null {
  const current = getTaskById(id);
  if (!current) return null;

  const now = new Date().toISOString();
  const fields: string[] = [];
  const params: any[] = [];

  Object.entries(updates).forEach(([key, value]) => {
    if (['id', 'createdAt', 'updatedAt'].includes(key)) return;
    
    fields.push(`${key} = ?`);
    if (['tags', 'metadata'].includes(key)) {
      params.push(JSON.stringify(value));
    } else {
      params.push(value);
    }
  });

  if (fields.length === 0) return current;

  // Add updatedAt and potentially statusChangedAt
  fields.push('updatedAt = ?');
  params.push(now);
  
  if (updates.status && updates.status !== current.status) {
    fields.push('statusChangedAt = ?');
    params.push(now);
  }

  params.push(id);
  
  db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  
  const updatedTask = getTaskById(id)!;
  broadcast('task', { action: 'update', task: updatedTask });
  return updatedTask;
}

export function deleteTask(id: string): boolean {
  const task = getTaskById(id);
  if (!task) return false;

  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  broadcast('task', { action: 'delete', id });
  return true;
}

function rowToTask(row: Record<string, unknown>): Task {
  return {
    ...row,
    id: row.id as string,
    title: row.title as string,
    description: row.description as string,
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    type: row.type as TaskType,
    complexity: row.complexity as number,
    danger: row.danger as number,
    assignedTo: row.assignedTo as string | null,
    list: row.list as string,
    tags: JSON.parse((row.tags as string) || '[]'),
    metadata: JSON.parse((row.metadata as string) || '{}'),
    dueDate: row.dueDate as string | null,
    estimatedMinutes: row.estimatedMinutes as number | null,
    parentId: row.parentId as string | null,
    projectId: row.projectId as string | null,
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
    statusChangedAt: row.statusChangedAt as string,
    backburnered: Boolean(row.backburnered),
  } as Task;
}
