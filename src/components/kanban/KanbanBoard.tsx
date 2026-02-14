"use client";

import { Task, TaskStatus } from "@/types";
import { KanbanColumn } from "./KanbanColumn";
import { Skeleton } from "@/components/ui/skeleton";

interface KanbanBoardProps {
  tasks: Task[];
  loading: boolean;
  onMoveTask: (id: string, status: TaskStatus) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onApproveTask?: (taskId: string) => void;
  onRejectTask?: (taskId: string) => void;
}

const columns: { id: TaskStatus; title: string; color: string }[] = [
  { id: "intake", title: "Intake", color: "border-purple-500" },
  { id: "ready", title: "Ready", color: "border-cyan-500" },
  { id: "backlog", title: "Backlog", color: "border-zinc-500" },
  { id: "in_progress", title: "In Progress", color: "border-blue-500" },
  { id: "review", title: "Review", color: "border-yellow-500" },
  { id: "paused", title: "Paused", color: "border-orange-500" },
  { id: "blocked", title: "Blocked", color: "border-red-500" },
  { id: "completed", title: "Completed", color: "border-green-500" },
  { id: "archived", title: "Archived", color: "border-zinc-700" },
];

export function KanbanBoard({
  tasks,
  loading,
  onMoveTask,
  onEditTask,
  onDeleteTask,
  onApproveTask,
  onRejectTask,
}: KanbanBoardProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map((column) => (
          <div key={column.id} className="bg-zinc-900 rounded-lg p-4 space-y-3 min-h-[400px]">
            <Skeleton className="h-6 w-24 bg-zinc-800" />
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 bg-zinc-800" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  const tasksByStatus = columns.reduce((acc, column) => {
    acc[column.id] = tasks.filter((task) => task.status === column.id);
    return acc;
  }, {} as Record<TaskStatus, Task[]>);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("taskId", taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    if (taskId) {
      onMoveTask(taskId, status);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-4 min-h-[500px] pb-4" style={{ minWidth: "max-content" }}>
        {columns.map((column) => (
          <div key={column.id} style={{ minWidth: "300px", maxWidth: "350px" }}>
            <KanbanColumn
              title={column.title}
              color={column.color}
              status={column.id}
              tasks={tasksByStatus[column.id] || []}
              onDragStart={handleDragStart}
              onDrop={(e) => handleDrop(e, column.id)}
              onDragOver={handleDragOver}
              onEditTask={onEditTask}
              onDeleteTask={onDeleteTask}
              onApproveTask={onApproveTask}
              onRejectTask={onRejectTask}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
