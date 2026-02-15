import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { getDb, createTask, getTasks, updateTask, deleteTask, closeDb } from './db';
import { join } from 'path';
import { tmpdir } from 'os';
import { unlinkSync } from 'fs';

const TEST_DB_PATH = join(tmpdir(), `mc-test-${process.pid}.db`);

// Check if better-sqlite3 native bindings are available (fails in CI without build tools)
let dbAvailable = true;
try {
  // Test if we can instantiate better-sqlite3
  require('better-sqlite3')(':memory:').close();
} catch {
  dbAvailable = false;
  console.warn('⚠️  Skipping DB tests - better-sqlite3 native bindings not available');
}

describe.skipIf(!dbAvailable)('Database Functions', () => {
  beforeAll(() => {
    process.env.TASKS_DB_PATH = TEST_DB_PATH;
    // Init schema for test database
    const db = getDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'intake',
        priority TEXT NOT NULL DEFAULT 'medium',
        complexity TEXT NOT NULL DEFAULT 'simple',
        danger TEXT NOT NULL DEFAULT 'safe',
        type TEXT NOT NULL DEFAULT 'manual',
        assignedTo TEXT,
        list TEXT NOT NULL DEFAULT 'agents',
        tags TEXT DEFAULT '[]',
        detailScore INTEGER DEFAULT 0,
        minDetailRequired INTEGER DEFAULT 0,
        autoBackburnered INTEGER DEFAULT 0,
        blockedBy TEXT DEFAULT '[]',
        blockerDescription TEXT DEFAULT '',
        dueDate TEXT,
        slaBreached INTEGER DEFAULT 0,
        estimatedMinutes INTEGER,
        actualMinutes INTEGER DEFAULT 0,
        reminderId TEXT,
        reminderList TEXT,
        reminderSyncedAt TEXT,
        parentId TEXT,
        projectId TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        completedAt TEXT,
        statusChangedAt TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'ui',
        metadata TEXT DEFAULT '{}'
      )
    `);
  });

  beforeEach(() => {
    // Clear all tasks before each test
    const db = getDb();
    db.exec('DELETE FROM tasks');
  });

  afterEach(() => {
    // Clear all tasks and close db after each test
    const db = getDb();
    db.exec('DELETE FROM tasks');
    closeDb();
  });

  afterAll(() => {
    closeDb();
    try { unlinkSync(TEST_DB_PATH); } catch {}
    try { unlinkSync(TEST_DB_PATH + '-wal'); } catch {}
    try { unlinkSync(TEST_DB_PATH + '-shm'); } catch {}
    delete process.env.TASKS_DB_PATH;
  });

  it('should create a task', () => {
    const task = createTask({
      title: 'Test Task',
      description: 'Test Description',
      status: 'intake',
      priority: 'medium',
      type: 'manual',
      assignedTo: null,
      tags: ['test'],
    });

    expect(task).toBeDefined();
    expect(task.id).toBeDefined();
    expect(task.title).toBe('Test Task');
    expect(task.status).toBe('intake');
    expect(task.priority).toBe('medium');
    expect(task.tags).toEqual(['test']);
  });

  it('should get all tasks', () => {
    // Create multiple tasks
    createTask({
      title: 'Task 1',
      status: 'intake',
      priority: 'high',
      type: 'manual',
      assignedTo: null,
      tags: [],
    });

    createTask({
      title: 'Task 2',
      status: 'in_progress',
      priority: 'low',
      type: 'auto',
      assignedTo: 'dev',
      tags: ['coding'],
    });

    const tasks = getTasks();
    expect(tasks).toHaveLength(2);
    const titles = tasks.map(t => t.title).sort();
    expect(titles).toEqual(['Task 1', 'Task 2']);
  });

  it('should update a task', () => {
    const task = createTask({
      title: 'Original Title',
      status: 'intake',
      priority: 'medium',
      type: 'manual',
      assignedTo: null,
      tags: [],
    });

    const updated = updateTask(task.id, {
      title: 'Updated Title',
      status: 'in_progress',
      priority: 'high',
    });

    expect(updated).toBeDefined();
    expect(updated!.title).toBe('Updated Title');
    expect(updated!.status).toBe('in_progress');
    expect(updated!.priority).toBe('high');
    expect(updated!.id).toBe(task.id);
  });

  it('should delete a task', () => {
    const task = createTask({
      title: 'To Delete',
      status: 'intake',
      priority: 'medium',
      type: 'manual',
      assignedTo: null,
      tags: [],
    });

    const deleted = deleteTask(task.id);
    expect(deleted).toBe(true);

    const tasks = getTasks();
    expect(tasks).toHaveLength(0);
  });

  it('should handle updating non-existent task', () => {
    const updated = updateTask('non-existent-id', { title: 'Should Fail' });
    expect(updated).toBeNull();
  });

  it('should handle deleting non-existent task', () => {
    const deleted = deleteTask('non-existent-id');
    expect(deleted).toBe(false);
  });

  it('should preserve tags array on create', () => {
    const task = createTask({
      title: 'Tagged Task',
      status: 'intake',
      priority: 'medium',
      type: 'manual',
      assignedTo: null,
      tags: ['urgent', 'frontend', 'bug'],
    });

    expect(task.tags).toEqual(['urgent', 'frontend', 'bug']);
  });

  it('should handle empty description', () => {
    const task = createTask({
      title: 'No Description',
      status: 'intake',
      priority: 'low',
      type: 'manual',
      assignedTo: null,
      tags: [],
    });

    expect(task.description).toBeUndefined();
  });
});
