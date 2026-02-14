"use client";

import { Task, TaskStatus } from "@/types";
import { TaskCard } from "./TaskCard";
import { IntakeApprovalCard } from "./IntakeApprovalCard";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  title: string;
  color: string;
  status: TaskStatus;
  tasks: Task[];
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onApproveTask?: (taskId: string) => void;
  onRejectTask?: (taskId: string) => void;
}

export function KanbanColumn({
  title,
  color,
  status,
  tasks,
  onDragStart,
  onDrop,
  onDragOver,
  onEditTask,
  onDeleteTask,
  onApproveTask,
  onRejectTask,
}: KanbanColumnProps) {
  const isIntakeColumn = status === "intake";
  return (
    <div
      className={cn(
        "bg-zinc-900 rounded-lg border-t-2 flex flex-col overflow-hidden",
        color
      )}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-zinc-100">{title}</h3>
          <span className="text-sm text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
            {tasks.length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px]">
        {tasks.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-zinc-600">Drop tasks here</p>
          </div>
        ) : (
          tasks.map((task) =>
            isIntakeColumn && onApproveTask && onRejectTask ? (
              <IntakeApprovalCard
                key={task.id}
                task={task}
                onAccept={() => onApproveTask(task.id)}
                onReject={() => onRejectTask(task.id)}
                onEdit={() => onEditTask(task)}
              />
            ) : (
              <TaskCard
                key={task.id}
                task={task}
                onDragStart={(e) => onDragStart(e, task.id)}
                onEdit={() => onEditTask(task)}
                onDelete={() => onDeleteTask(task.id)}
              />
            )
          )
        )}
      </div>
    </div>
  );
}
