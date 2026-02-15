"use client";

import { useState, useRef, useEffect } from "react";
import { Task, TaskStatus } from "@/types";
import { TaskCard } from "./TaskCard";
import { IntakeApprovalCard } from "./IntakeApprovalCard";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";

interface KanbanColumnProps {
  title: string;
  color: string;
  description?: string;
  status: TaskStatus;
  tasks: Task[];
  agents?: { id: string; name: string }[];
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onMoveTask?: (id: string, status: TaskStatus) => void;
  onApproveTask?: (taskId: string) => void;
  onRejectTask?: (taskId: string) => void;
  onDispatchTask?: (taskId: string, agentId: string) => void;
  onDecomposeTask?: (task: Task) => void;
  onPauseTask?: (taskId: string) => void;
}

export function KanbanColumn({
  title,
  color,
  description,
  status,
  tasks,
  agents,
  onDragStart,
  onDrop,
  onDragOver,
  onEditTask,
  onDeleteTask,
  onMoveTask,
  onApproveTask,
  onRejectTask,
  onDispatchTask,
  onDecomposeTask,
  onPauseTask,
}: KanbanColumnProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [tooltipOnRight, setTooltipOnRight] = useState(false);
  const columnRef = useRef<HTMLDivElement>(null);
  const isIntakeColumn = status === "intake";
  // Only show dispatch on ready/intake/backlog columns
  const canDispatch = ["ready", "intake", "backlog"].includes(status) && onDispatchTask && agents && agents.length > 0;

  // Detect column position for smart tooltip positioning
  useEffect(() => {
    if (columnRef.current) {
      const rect = columnRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      // If column is past 60% of screen width, position tooltip on right
      setTooltipOnRight(rect.left > viewportWidth * 0.6);
    }
  }, []);

  return (
    <div
      ref={columnRef}
      className={cn(
        "bg-zinc-900 rounded-lg border-t-2 flex flex-col overflow-hidden min-w-[280px] h-full",
        color
      )}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <div className="p-3 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <h3 className="font-medium text-sm text-zinc-100">{title}</h3>
            {description && (
              <div className="relative">
                <button
                  className="text-zinc-500 hover:text-zinc-300 transition-colors"
                  onMouseEnter={() => setShowInfo(true)}
                  onMouseLeave={() => setShowInfo(false)}
                  onClick={() => setShowInfo(!showInfo)}
                  aria-label={`Information about ${title} column`}
                  aria-expanded={showInfo}
                  aria-controls="column-tooltip"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
                {showInfo && (
                  <div
                    id="column-tooltip"
                    role="tooltip"
                    className={cn(
                      "absolute top-6 z-50 w-64 p-2.5 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl text-xs text-zinc-300 leading-relaxed",
                      tooltipOnRight ? "right-0" : "left-0"
                    )}
                  >
                    {description}
                  </div>
                )}
              </div>
            )}
          </div>
          <span className="text-xs text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
            {tasks.length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[100px] sm:min-h-[200px] max-h-[400px] sm:max-h-[600px]">
        {tasks.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-xs text-zinc-600">Drop tasks here</p>
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
                columnStatus={status}
                agents={canDispatch ? agents : undefined}
                onDragStart={(e) => onDragStart(e, task.id)}
                onEdit={() => onEditTask(task)}
                onDelete={() => onDeleteTask(task.id)}
                onMoveTask={onMoveTask}
                onDispatchTask={onDispatchTask}
                onDecompose={() => onDecomposeTask?.(task)}
                onPause={onPauseTask}
              />
            )
          )
        )}
      </div>
    </div>
  );
}
