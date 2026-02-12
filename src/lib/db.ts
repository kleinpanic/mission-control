// Mission Control - SQLite Database
import Database from 'better-sqlite3';
import { join } from 'path';
import { Task, TaskStatus, TaskPriority, TaskType } from '@/types';

const DB_PATH = join(process.cwd(), 'data', 'tasks.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema();
  }
  return db;
}

function initSchema() {
  if (!db) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL CHECK(status IN ('queue', 'inProgress', 'completed')),
      priority TEXT NOT NULL CHECK(priority IN ('low', 'medium', 'high')),
      type TEXT NOT NULL CHECK(type IN ('manual', 'auto')),
      assignedTo TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      completedAt TEXT,
      tags TEXT NOT NULL,
      metadata TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_assignedTo ON tasks(assignedTo);
    CREATE INDEX IF NOT EXISTS idx_tasks_createdAt ON tasks(createdAt DESC);
  `);
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
  };

  const stmt = db.prepare(`
    INSERT INTO tasks (id, title, description, status, priority, type, assignedTo, createdAt, updatedAt, completedAt, tags, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    newTask.id,
    newTask.title,
    newTask.description || null,
    newTask.status,
    newTask.priority,
    newTask.type,
    newTask.assignedTo || null,
    newTask.createdAt,
    newTask.updatedAt,
    newTask.completedAt || null,
    JSON.stringify(newTask.tags),
    newTask.metadata ? JSON.stringify(newTask.metadata) : null
  );

  return newTask;
}

export function getTasks(filters?: {
  status?: TaskStatus;
  assignedTo?: string;
  type?: TaskType;
}): Task[] {
  const db = getDb();
  let query = 'SELECT * FROM tasks WHERE 1=1';
  const params: any[] = [];

  if (filters?.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }

  if (filters?.assignedTo) {
    query += ' AND assignedTo = ?';
    params.push(filters.assignedTo);
  }

  if (filters?.type) {
    query += ' AND type = ?';
    params.push(filters.type);
  }

  query += ' ORDER BY createdAt DESC';

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

  const updated: Task = {
    ...existing,
    ...updates,
    id: existing.id, // Prevent ID change
    createdAt: existing.createdAt, // Prevent createdAt change
    updatedAt: new Date().toISOString(),
  };

  const stmt = db.prepare(`
    UPDATE tasks
    SET title = ?, description = ?, status = ?, priority = ?, type = ?,
        assignedTo = ?, updatedAt = ?, completedAt = ?, tags = ?, metadata = ?
    WHERE id = ?
  `);

  stmt.run(
    updated.title,
    updated.description || null,
    updated.status,
    updated.priority,
    updated.type,
    updated.assignedTo || null,
    updated.updatedAt,
    updated.completedAt || null,
    JSON.stringify(updated.tags),
    updated.metadata ? JSON.stringify(updated.metadata) : null,
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
    type: row.type as TaskType,
    assignedTo: row.assignedTo || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt || undefined,
    tags: JSON.parse(row.tags) as string[],
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  };
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
