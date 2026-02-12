"use client";

import { useEffect, useState } from "react";
import { useTasksStore } from "@/stores/tasks";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { TaskModal } from "@/components/kanban/TaskModal";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Task } from "@/types";

export default function KanbanPage() {
  const { tasks, setTasks, addTask, updateTask, deleteTask, moveTask } = useTasksStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch tasks from API
    async function fetchTasks() {
      try {
        const res = await fetch("/api/tasks");
        const data = await res.json();
        if (data.tasks) {
          setTasks(data.tasks);
        }
      } catch (error) {
        console.error("Failed to fetch tasks:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchTasks();
  }, [setTasks]);

  const handleCreateTask = async (task: Omit<Task, "id" | "createdAt" | "updatedAt">) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(task),
      });
      const data = await res.json();
      if (data.task) {
        addTask(data.task);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Failed to create task:", error);
    }
  };

  const handleUpdateTask = async (id: string, updates: Partial<Task>) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      const data = await res.json();
      if (data.task) {
        updateTask(id, data.task);
      }
      setEditingTask(null);
    } catch (error) {
      console.error("Failed to update task:", error);
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await fetch(`/api/tasks?id=${id}`, { method: "DELETE" });
      deleteTask(id);
    } catch (error) {
      console.error("Failed to delete task:", error);
    }
  };

  const handleMoveTask = async (id: string, newStatus: Task["status"]) => {
    moveTask(id, newStatus);
    // Persist to API
    try {
      await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
    } catch (error) {
      console.error("Failed to persist task move:", error);
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-100">Kanban Board</h1>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-orange-600 hover:bg-orange-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Task
        </Button>
      </div>

      <div className="flex-1 min-h-0">
        <KanbanBoard
          tasks={tasks}
          loading={loading}
          onMoveTask={handleMoveTask}
          onEditTask={setEditingTask}
          onDeleteTask={handleDeleteTask}
        />
      </div>

      <TaskModal
        open={isModalOpen || !!editingTask}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTask(null);
        }}
        onSubmit={editingTask ? (data) => handleUpdateTask(editingTask.id, data) : handleCreateTask}
        task={editingTask}
      />
    </div>
  );
}
