// Mission Control - Tasks Store (Kanban — shared with oc-tasks)
import { create } from 'zustand';
import { Task, TaskStatus } from '@/types';

interface TasksState {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTask: (id: string, newStatus: TaskStatus) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useTasksStore = create<TasksState>((set) => ({
  tasks: [],
  loading: false,
  error: null,

  setTasks: (tasks) => set({ tasks, error: null }),

  addTask: (task) =>
    set((state) => ({
      tasks: [...state.tasks, task],
    })),

  updateTask: (id, updates) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === id
          ? { ...task, ...updates, updatedAt: new Date().toISOString() }
          : task
      ),
    })),

  deleteTask: (id) =>
    set((state) => ({
      tasks: state.tasks.filter((task) => task.id !== id),
    })),

  moveTask: (id, newStatus) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === id
          ? {
              ...task,
              status: newStatus,
              updatedAt: new Date().toISOString(),
              statusChangedAt: new Date().toISOString(),
              completedAt: newStatus === 'completed' ? new Date().toISOString() : task.completedAt,
            }
          : task
      ),
    })),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error, loading: false }),
}));
