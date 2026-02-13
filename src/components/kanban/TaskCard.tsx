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
import { MoreHorizontal, Pencil, Trash2, Bot, Clock } from "lucide-react";
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

const typeConfig: Record<string, { color: string; label: string }> = {
  manual: { color: "bg-blue-600 text-blue-100", label: "Manual" },
  auto: { color: "bg-purple-600 text-purple-100", label: "Auto" },
  sync: { color: "bg-cyan-600 text-cyan-100", label: "Sync" },
};

export function TaskCard({ task, onDragStart, onEdit, onDelete }: TaskCardProps) {
  const priority = priorityConfig[task.priority];
  const type = typeConfig[task.type];

  return (
    <Card
      className="bg-zinc-800 border-zinc-700 cursor-grab active:cursor-grabbing hover:border-zinc-600 transition-colors"
      draggable
      onDragStart={onDragStart}
    >
      <CardContent className="p-3 space-y-2">
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

        {task.description && (
          <p className="text-xs text-zinc-400 line-clamp-2">{task.description}</p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={cn("text-xs", priority.color)}>
            {task.priority}
          </Badge>
          <Badge className={cn("text-xs", type.color)}>
            {type.label}
          </Badge>
          {task.assignedTo && (
            <Badge variant="secondary" className="text-xs bg-zinc-700 text-zinc-300">
              <Bot className="w-3 h-3 mr-1" />
              {task.assignedTo}
            </Badge>
          )}
        </div>

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
      </CardContent>
    </Card>
  );
}
