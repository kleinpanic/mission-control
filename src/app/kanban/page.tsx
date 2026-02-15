"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useTasksStore } from "@/stores/tasks";
import { useGateway } from "@/providers/GatewayProvider";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { TaskModal } from "@/components/kanban/TaskModal";
import { DecomposeModal } from "@/components/kanban/DecomposeModal";
import { QuickAdd } from "@/components/tasks/QuickAdd";
import { TaskSearch, TaskFilters } from "@/components/kanban/TaskSearch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, RefreshCw } from "lucide-react";
import { Task } from "@/types";
import { toast } from "sonner";

export default function KanbanPage() {
  const { tasks, setTasks, addTask, updateTask, deleteTask, moveTask } = useTasksStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [decomposeTask, setDecomposeTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<TaskFilters>({});
  const { connected, request } = useGateway();

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks?list=agents,shared");
      const data = await res.json();
      if (data.tasks) {
        setTasks(data.tasks);
      }
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    } finally {
      setLoading(false);
    }
  }, [setTasks]);

  // Fetch agents from gateway for dispatch dropdown
  const fetchAgents = useCallback(async () => {
    if (!connected) return;
    try {
      const result = await request<any>("agents.list");
      if (result?.agents) {
        setAgents(result.agents.map((a: any) => ({ id: a.id, name: a.name || a.id })));
      }
    } catch (error) {
      console.error("Failed to fetch agents:", error);
    }
  }, [connected, request]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // Periodic refresh every 30s to catch external DB changes (oc-tasks CLI)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchTasks();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  // Filter tasks based on search and filters
  const filteredTasks = useMemo(() => {
    let filtered = tasks;

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query) ||
        task.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply priority filter
    if (filters.priority) {
      filtered = filtered.filter(task => task.priority === filters.priority);
    }

    // Apply assignedTo filter
    if (filters.assignedTo) {
      filtered = filtered.filter(task => task.assignedTo === filters.assignedTo);
    }

    // Apply tags filter
    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(task =>
        filters.tags!.some(tag => task.tags?.includes(tag))
      );
    }

    return filtered;
  }, [tasks, searchQuery, filters]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTasks();
    setRefreshing(false);
    toast.success("Tasks refreshed");
  };

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
        toast.success("Task created");
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Failed to create task:", error);
      toast.error("Failed to create task");
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
      toast.error("Failed to update task");
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await fetch(`/api/tasks?id=${id}`, { method: "DELETE" });
      deleteTask(id);
      toast.success("Task deleted");
    } catch (error) {
      console.error("Failed to delete task:", error);
      toast.error("Failed to delete task");
    }
  };

  const handleMoveTask = async (id: string, newStatus: Task["status"]) => {
    moveTask(id, newStatus);
    try {
      await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
    } catch (error) {
      console.error("Failed to persist task move:", error);
      toast.error("Failed to save task status");
    }
  };

  const handleDispatchTask = async (taskId: string, agentId: string) => {
    try {
      const res = await fetch("/api/tasks/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, agentId, notify: true }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        toast.error(data.error || "Failed to dispatch task");
        return;
      }

      if (data.task) {
        updateTask(taskId, data.task);
      }

      if (data.dispatch?.sent) {
        toast.success(`Task dispatched to ${agentId}`, {
          description: "Task sent to agent and moved to In Progress.",
        });
      } else {
        toast.warning(`Task assigned to ${agentId}`, {
          description: `Moved to In Progress but delivery failed: ${data.dispatch?.error || "Unknown error"}`,
        });
      }
    } catch (error) {
      console.error("Failed to dispatch task:", error);
      toast.error("Failed to dispatch task");
    }
  };

  const handleApproveTask = async (taskId: string) => {
    await handleMoveTask(taskId, "ready");
  };

  const handleRejectTask = async (taskId: string) => {
    await handleMoveTask(taskId, "archived");
  };

  const handlePauseTask = async (taskId: string) => {
    try {
      const res = await fetch("/api/tasks/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        toast.error(data.error || "Failed to pause task");
        return;
      }
      
      if (data.task) {
        updateTask(taskId, data.task);
      }
      
      if (data.autonomousSessionStopped) {
        toast.success(data.message, {
          description: "Autonomous session stopped successfully.",
        });
      } else {
        toast.success("Task paused");
      }
    } catch (error) {
      console.error("Failed to pause task:", error);
      toast.error("Failed to pause task");
    }
  };

  const readyCount = tasks.filter(t => t.status === "ready").length;
  const inProgressCount = tasks.filter(t => t.status === "in_progress").length;
  const reviewCount = tasks.filter(t => t.status === "review").length;

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-zinc-100">Kanban Board</h1>
          <div className="flex gap-1.5">
            {readyCount > 0 && (
              <Badge variant="outline" className="text-xs text-cyan-400 border-cyan-500/50">
                {readyCount} ready
              </Badge>
            )}
            {inProgressCount > 0 && (
              <Badge variant="outline" className="text-xs text-blue-400 border-blue-500/50">
                {inProgressCount} active
              </Badge>
            )}
            {reviewCount > 0 && (
              <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-500/50">
                {reviewCount} review
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="bg-zinc-800 hover:bg-zinc-700"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Sync
          </Button>
          <Button
            onClick={() => setIsModalOpen(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Task
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <TaskSearch
        onSearch={setSearchQuery}
        onFilterChange={setFilters}
        activeFilters={filters}
      />

      {/* Quick Add - Natural Language Task Entry */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
          <span>Quick Add</span>
          <span className="text-xs text-zinc-500">Natural language task entry</span>
        </h3>
        <QuickAdd onTaskCreated={handleRefresh} />
        <p className="text-xs text-zinc-500 mt-2">
          Try: &ldquo;remind me to review PR tomorrow at 3pm&rdquo; or &ldquo;urgent: fix bug in auth, assign to dev&rdquo;
        </p>
      </div>

      <div className="flex-1 min-h-0">
        <KanbanBoard
          tasks={filteredTasks}
          loading={loading}
          agents={agents}
          onMoveTask={handleMoveTask}
          onEditTask={setEditingTask}
          onDeleteTask={handleDeleteTask}
          onApproveTask={handleApproveTask}
          onRejectTask={handleRejectTask}
          onDispatchTask={handleDispatchTask}
          onDecomposeTask={setDecomposeTask}
          onPauseTask={handlePauseTask}
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
        agents={agents}
      />

      {decomposeTask && (
        <DecomposeModal
          open={!!decomposeTask}
          onClose={() => setDecomposeTask(null)}
          taskId={decomposeTask.id}
          taskTitle={decomposeTask.title}
          onDecomposed={() => {
            setDecomposeTask(null);
            handleRefresh();
          }}
        />
      )}
    </div>
  );
}
