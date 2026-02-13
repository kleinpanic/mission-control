// Mission Control - SQLite Database (Shared with oc-tasks)
import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';
import { Task, TaskStatus, TaskPriority, TaskType } from '@/types';

// Use shared database — single source of truth for all task systems
function getDbPath(): string {
  return process.env.TASKS_DB_PATH
    || join(homedir(), '.openclaw', 'data', 'tasks.db');
}

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(getDbPath());
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
  }
  return db;
}

// ===== CRUD Operations =====

export function createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Task {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const newTask: Task = {
    ...task,
    id,
    createdAt: now,
    updatedAt: now,
    statusChangedAt: now,
    detailScore: 0,
    minDetailRequired: 0,
    autoBackburnered: false,
    slaBreached: false,
    blockedBy: [],
    blockerDescription: '',
    actualMinutes: 0,
    source: 'ui',
  };

  const stmt = db.prepare(`
    INSERT INTO tasks (
      id, title, description, status, priority, complexity, danger, type,
      assignedTo, list, tags, detailScore, minDetailRequired, autoBackburnered,
      blockedBy, blockerDescription, dueDate, slaBreached,
      estimatedMinutes, actualMinutes, reminderId, reminderList, reminderSyncedAt,
      parentId, projectId, createdAt, updatedAt, completedAt, statusChangedAt,
      source, metadata
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?
    )
  `);

  stmt.run(
    newTask.id,
    newTask.title,
    newTask.description || '',
    newTask.status,
    newTask.priority,
    newTask.complexity || 'simple',
    newTask.danger || 'safe',
    newTask.type,
    newTask.assignedTo || null,
    newTask.list || 'agents',
    JSON.stringify(newTask.tags),
    newTask.detailScore,
    newTask.minDetailRequired,
    newTask.autoBackburnered ? 1 : 0,
    JSON.stringify(newTask.blockedBy),
    newTask.blockerDescription || '',
    newTask.dueDate || null,
    newTask.slaBreached ? 1 : 0,
    newTask.estimatedMinutes || null,
    newTask.actualMinutes || 0,
    null, null, null,
    newTask.parentId || null,
    newTask.projectId || null,
    newTask.createdAt,
    newTask.updatedAt,
    newTask.completedAt || null,
    newTask.statusChangedAt,
    newTask.source || 'ui',
    newTask.metadata ? JSON.stringify(newTask.metadata) : '{}'
  );

  return newTask;
}

export function getTasks(filters?: {
  status?: TaskStatus | TaskStatus[];
  assignedTo?: string;
  type?: TaskType;
  priority?: TaskPriority;
  list?: string;
  tag?: string;
  backburnered?: boolean;
  sort?: string;
}): Task[] {
  const db = getDb();
  let query = 'SELECT * FROM tasks WHERE 1=1';
  const params: any[] = [];

  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      query += ` AND status IN (${filters.status.map(() => '?').join(',')})`;
      params.push(...filters.status);
    } else {
      query += ' AND status = ?';
      params.push(filters.status);
    }
  }

  if (filters?.assignedTo) {
    query += ' AND assignedTo = ?';
    params.push(filters.assignedTo);
  }

  if (filters?.type) {
    query += ' AND type = ?';
    params.push(filters.type);
  }

  if (filters?.priority) {
    query += ' AND priority = ?';
    params.push(filters.priority);
  }

  if (filters?.list) {
    query += ' AND list = ?';
    params.push(filters.list);
  }

  if (filters?.tag) {
    query += ' AND tags LIKE ?';
    params.push(`%"${filters.tag}"%`);
  }

  if (filters?.backburnered !== undefined) {
    query += ' AND autoBackburnered = ?';
    params.push(filters.backburnered ? 1 : 0);
  }

  // Sort
  switch (filters?.sort) {
    case 'priority':
      query += ` ORDER BY
        CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
        createdAt DESC`;
      break;
    case 'due':
      query += ' ORDER BY dueDate IS NULL, dueDate ASC, createdAt DESC';
      break;
    case 'updated':
      query += ' ORDER BY updatedAt DESC';
      break;
    default:
      query += ' ORDER BY createdAt DESC';
      break;
  }

  const stmt = db.prepare(query);
  const rows = stmt.all(...params) as any[];

  return rows.map(rowToTask);
}

export function getTask(id: string): Task | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM tasks WHERE id = ?');
  const row = stmt.get(id) as any;

  return row ? rowToTask(row) : null;
}

export function updateTask(id: string, updates: Partial<Task>): Task | null {
  const db = getDb();
  const existing = getTask(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const updated: Task = {
    ...existing,
    ...updates,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: now,
  };

  // Track status change
  if (updates.status && updates.status !== existing.status) {
    updated.statusChangedAt = now;
    if (updates.status === 'completed') {
      updated.completedAt = now;
    }
  }

  const stmt = db.prepare(`
    UPDATE tasks
    SET title = ?, description = ?, status = ?, priority = ?, complexity = ?,
        danger = ?, type = ?, assignedTo = ?, list = ?, updatedAt = ?,
        completedAt = ?, statusChangedAt = ?, tags = ?, metadata = ?,
        dueDate = ?, estimatedMinutes = ?, parentId = ?, projectId = ?,
        blockerDescription = ?
    WHERE id = ?
  `);

  stmt.run(
    updated.title,
    updated.description || '',
    updated.status,
    updated.priority,
    updated.complexity || 'simple',
    updated.danger || 'safe',
    updated.type,
    updated.assignedTo || null,
    updated.list || 'agents',
    updated.updatedAt,
    updated.completedAt || null,
    updated.statusChangedAt || now,
    JSON.stringify(updated.tags),
    updated.metadata ? JSON.stringify(updated.metadata) : '{}',
    updated.dueDate || null,
    updated.estimatedMinutes || null,
    updated.parentId || null,
    updated.projectId || null,
    updated.blockerDescription || '',
    id
  );

  return updated;
}

export function deleteTask(id: string): boolean {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM tasks WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// ===== Helper Functions =====

function rowToTask(row: any): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description || undefined,
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    complexity: row.complexity || 'simple',
    danger: row.danger || 'safe',
    type: row.type as TaskType,
    assignedTo: row.assignedTo || null,
    list: row.list || 'agents',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt || undefined,
    statusChangedAt: row.statusChangedAt || row.updatedAt,
    tags: JSON.parse(row.tags || '[]') as string[],
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    detailScore: row.detailScore || 0,
    minDetailRequired: row.minDetailRequired || 0,
    autoBackburnered: !!row.autoBackburnered,
    slaBreached: !!row.slaBreached,
    blockedBy: JSON.parse(row.blockedBy || '[]'),
    blockerDescription: row.blockerDescription || '',
    dueDate: row.dueDate || null,
    estimatedMinutes: row.estimatedMinutes || null,
    actualMinutes: row.actualMinutes || 0,
    parentId: row.parentId || null,
    projectId: row.projectId || null,
    source: row.source || 'ui',
  };
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
