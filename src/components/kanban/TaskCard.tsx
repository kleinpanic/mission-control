"use client";

import { Task } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, Bot, Clock, AlertTriangle, Brain, Target, Calendar, Ban } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskCardProps {
  task: Task;
  onDragStart: (e: React.DragEvent) => void;
  onEdit: () => void;
  onDelete: () => void;
}

const priorityConfig: Record<string, { color: string }> = {
  low: { color: "bg-zinc-600 text-zinc-300" },
  medium: { color: "bg-yellow-600 text-yellow-100" },
  high: { color: "bg-red-600 text-red-100" },
  critical: { color: "bg-red-800 text-red-100" },
};

const complexityConfig: Record<string, { color: string; icon: typeof Brain }> = {
  trivial: { color: "bg-green-600 text-green-100", icon: Target },
  simple: { color: "bg-cyan-600 text-cyan-100", icon: Target },
  moderate: { color: "bg-yellow-600 text-yellow-100", icon: Brain },
  complex: { color: "bg-orange-600 text-orange-100", icon: Brain },
  epic: { color: "bg-red-600 text-red-100", icon: Brain },
};

const dangerConfig: Record<string, { color: string; icon: typeof AlertTriangle }> = {
  safe: { color: "bg-green-600 text-green-100", icon: Target },
  low: { color: "bg-cyan-600 text-cyan-100", icon: AlertTriangle },
  medium: { color: "bg-yellow-600 text-yellow-100", icon: AlertTriangle },
  high: { color: "bg-orange-600 text-orange-100", icon: AlertTriangle },
  critical: { color: "bg-red-600 text-red-100", icon: AlertTriangle },
};

const typeConfig: Record<string, { color: string; label: string }> = {
  manual: { color: "bg-blue-600 text-blue-100", label: "Manual" },
  auto: { color: "bg-purple-600 text-purple-100", label: "Auto" },
  sync: { color: "bg-cyan-600 text-cyan-100", label: "Sync" },
};

export function TaskCard({ task, onDragStart, onEdit, onDelete }: TaskCardProps) {
  const priority = priorityConfig[task.priority];
  const type = typeConfig[task.type];
  const complexity = task.complexity ? complexityConfig[task.complexity] : null;
  const danger = task.danger ? dangerConfig[task.danger] : null;
  const ComplexityIcon = complexity?.icon;
  const DangerIcon = danger?.icon;

  return (
    <Card
      className="bg-zinc-800 border-zinc-700 cursor-grab active:cursor-grabbing hover:border-zinc-600 transition-colors"
      draggable
      onDragStart={onDragStart}
    >
      <CardContent className="p-3 space-y-2">
        {/* Title & Actions */}
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-medium text-zinc-100 flex-1">
            {task.title}
          </h4>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-100"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zinc-800 border-zinc-700">
              <DropdownMenuItem
                onClick={onEdit}
                className="text-zinc-300 focus:bg-zinc-700"
              >
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onDelete}
                className="text-red-400 focus:bg-zinc-700 focus:text-red-400"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Description */}
        {task.description && (
          <p className="text-xs text-zinc-400 line-clamp-2">{task.description}</p>
        )}

        {/* Primary Badges: Priority, Type, Complexity, Danger */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={cn("text-xs", priority.color)}>
            {task.priority}
          </Badge>
          <Badge className={cn("text-xs", type.color)}>
            {type.label}
          </Badge>
          {complexity && ComplexityIcon && (
            <Badge className={cn("text-xs flex items-center gap-1", complexity.color)}>
              <ComplexityIcon className="w-3 h-3" />
              {task.complexity}
            </Badge>
          )}
          {danger && DangerIcon && (
            <Badge className={cn("text-xs flex items-center gap-1", danger.color)}>
              <DangerIcon className="w-3 h-3" />
              {task.danger}
            </Badge>
          )}
        </div>

        {/* Detail Score & Recommended Model */}
        {(task.detailScore !== undefined || task.recommendedModel) && (
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {task.detailScore !== undefined && (
              <span className="text-zinc-400">
                Detail: <span className="text-zinc-200 font-mono">{task.detailScore}</span>
                {task.minDetailRequired !== undefined && (
                  <span className="text-zinc-500"> / {task.minDetailRequired}</span>
                )}
              </span>
            )}
            {task.recommendedModel && (
              <Badge variant="outline" className="text-xs border-orange-600 text-orange-400">
                <Bot className="w-3 h-3 mr-1" />
                {task.recommendedModel}
              </Badge>
            )}
          </div>
        )}

        {/* Assigned To */}
        {task.assignedTo && (
          <Badge variant="secondary" className="text-xs bg-zinc-700 text-zinc-300 w-fit">
            <Bot className="w-3 h-3 mr-1" />
            {task.assignedTo}
          </Badge>
        )}

        {/* Due Date & Time Estimates */}
        {(task.dueDate || task.estimatedMinutes || task.actualMinutes) && (
          <div className="flex items-center gap-3 text-xs text-zinc-400">
            {task.dueDate && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(task.dueDate).toLocaleDateString()}
              </div>
            )}
            {task.estimatedMinutes && (
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                ~{task.estimatedMinutes}m
              </div>
            )}
            {task.actualMinutes && task.actualMinutes > 0 && (
              <span className="text-zinc-500">({task.actualMinutes}m actual)</span>
            )}
          </div>
        )}

        {/* Blocked By */}
        {task.blockedBy && task.blockedBy.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs">
            <Ban className="w-3 h-3 text-red-400" />
            <span className="text-red-400 font-medium">
              Blocked by: {task.blockedBy.join(", ")}
            </span>
          </div>
        )}
        {task.blockerDescription && (
          <p className="text-xs text-red-400 italic">{task.blockerDescription}</p>
        )}

        {/* Auto-backburnered & SLA Breached Warnings */}
        {(task.autoBackburnered || task.slaBreached) && (
          <div className="flex gap-2 flex-wrap">
            {task.autoBackburnered && (
              <Badge className="text-xs bg-zinc-700 text-yellow-400">
                Auto-backburnered
              </Badge>
            )}
            {task.slaBreached && (
              <Badge className="text-xs bg-red-900 text-red-200">
                SLA Breached
              </Badge>
            )}
          </div>
        )}

        {/* Tags */}
        {task.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {task.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-1.5 py-0.5 bg-zinc-700 text-zinc-400 rounded"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Parent/Project Info */}
        {(task.parentId || task.projectId) && (
          <div className="text-xs text-zinc-500">
            {task.projectId && <span>Project: {task.projectId}</span>}
            {task.parentId && <span className="ml-2">Parent: {task.parentId}</span>}
          </div>
        )}

        {/* Metadata Preview (if non-empty) */}
        {task.metadata && Object.keys(task.metadata).length > 0 && (
          <details className="text-xs text-zinc-500">
            <summary className="cursor-pointer hover:text-zinc-400">Metadata</summary>
            <pre className="mt-1 text-[10px] bg-zinc-900 p-1 rounded overflow-x-auto">
              {JSON.stringify(task.metadata, null, 2)}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
