import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb, createTask, getTasks, updateTask, deleteTask, closeDb } from './db';

describe('Database Functions', () => {
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

  it('should create a task', () => {
    const task = createTask({
      title: 'Test Task',
      description: 'Test Description',
      status: 'queue',
      priority: 'medium',
      type: 'manual',
      assignedTo: null,
      tags: ['test'],
    });

    expect(task).toBeDefined();
    expect(task.id).toBeDefined();
    expect(task.title).toBe('Test Task');
    expect(task.status).toBe('queue');
    expect(task.priority).toBe('medium');
    expect(task.tags).toEqual(['test']);
  });

  it('should get all tasks', () => {
    // Create multiple tasks
    createTask({
      title: 'Task 1',
      status: 'queue',
      priority: 'high',
      type: 'manual',
      assignedTo: null,
      tags: [],
    });

    createTask({
      title: 'Task 2',
      status: 'inProgress',
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
      status: 'queue',
      priority: 'medium',
      type: 'manual',
      assignedTo: null,
      tags: [],
    });

    const updated = updateTask(task.id, {
      title: 'Updated Title',
      status: 'inProgress',
      priority: 'high',
    });

    expect(updated).toBeDefined();
    expect(updated!.title).toBe('Updated Title');
    expect(updated!.status).toBe('inProgress');
    expect(updated!.priority).toBe('high');
    expect(updated!.id).toBe(task.id);
  });

  it('should delete a task', () => {
    const task = createTask({
      title: 'To Delete',
      status: 'queue',
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
      status: 'queue',
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
      status: 'queue',
      priority: 'low',
      type: 'manual',
      assignedTo: null,
      tags: [],
    });

    expect(task.description).toBeUndefined();
  });
});
