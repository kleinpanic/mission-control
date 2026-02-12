import { describe, it, expect, beforeEach } from 'vitest';
import { useTasksStore } from './tasks';
import { Task } from '@/types';

describe('Tasks Store', () => {
  beforeEach(() => {
    // Reset store before each test
    useTasksStore.setState({ tasks: [] });
  });

  it('should initialize with empty tasks', () => {
    const { tasks } = useTasksStore.getState();
    expect(tasks).toEqual([]);
  });

  it('should set tasks', () => {
    const mockTasks: Task[] = [
      {
        id: '1',
        title: 'Task 1',
        status: 'queue',
        priority: 'high',
        type: 'manual',
        assignedTo: null,
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '2',
        title: 'Task 2',
        status: 'inProgress',
        priority: 'medium',
        type: 'auto',
        assignedTo: 'dev',
        tags: ['coding'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    useTasksStore.getState().setTasks(mockTasks);
    const { tasks } = useTasksStore.getState();
    expect(tasks).toEqual(mockTasks);
    expect(tasks).toHaveLength(2);
  });

  it('should add a task', () => {
    const newTask: Task = {
      id: '1',
      title: 'New Task',
      status: 'queue',
      priority: 'low',
      type: 'manual',
      assignedTo: null,
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    useTasksStore.getState().addTask(newTask);
    const { tasks } = useTasksStore.getState();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toEqual(newTask);
  });

  it('should update a task', () => {
    const initialTask: Task = {
      id: '1',
      title: 'Original',
      status: 'queue',
      priority: 'medium',
      type: 'manual',
      assignedTo: null,
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    useTasksStore.setState({ tasks: [initialTask] });

    const updates = {
      title: 'Updated',
      status: 'inProgress' as const,
      priority: 'high' as const,
    };

    useTasksStore.getState().updateTask('1', updates);
    const { tasks } = useTasksStore.getState();

    expect(tasks[0].title).toBe('Updated');
    expect(tasks[0].status).toBe('inProgress');
    expect(tasks[0].priority).toBe('high');
    expect(tasks[0].id).toBe('1');
  });

  it('should delete a task', () => {
    const task1: Task = {
      id: '1',
      title: 'Task 1',
      status: 'queue',
      priority: 'medium',
      type: 'manual',
      assignedTo: null,
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const task2: Task = {
      id: '2',
      title: 'Task 2',
      status: 'queue',
      priority: 'medium',
      type: 'manual',
      assignedTo: null,
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    useTasksStore.setState({ tasks: [task1, task2] });
    useTasksStore.getState().deleteTask('1');

    const { tasks } = useTasksStore.getState();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe('2');
  });

  it('should move task to different status', () => {
    const task: Task = {
      id: '1',
      title: 'Task',
      status: 'queue',
      priority: 'medium',
      type: 'manual',
      assignedTo: null,
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    useTasksStore.setState({ tasks: [task] });
    useTasksStore.getState().moveTask('1', 'completed');

    const { tasks } = useTasksStore.getState();
    expect(tasks[0].status).toBe('completed');
  });

  it('should not update non-existent task', () => {
    const task: Task = {
      id: '1',
      title: 'Task',
      status: 'queue',
      priority: 'medium',
      type: 'manual',
      assignedTo: null,
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    useTasksStore.setState({ tasks: [task] });
    useTasksStore.getState().updateTask('999', { title: 'Should not update' });

    const { tasks } = useTasksStore.getState();
    expect(tasks[0].title).toBe('Task');
  });
});
