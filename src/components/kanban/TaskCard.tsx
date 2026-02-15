"use client";

import { Task, TaskStatus } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, Bot, Play, Pause, ArrowRight, RotateCcw, CheckCircle, Archive, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskCardProps {
  task: Task;
  columnStatus: TaskStatus;
  agents?: { id: string; name: string }[];
  onDragStart: (e: React.DragEvent) => void;
  onEdit: () => void;
  onDelete: () => void;
  onMoveTask?: (id: string, status: TaskStatus) => void;
  onDispatchTask?: (taskId: string, agentId: string) => void;
}

const priorityColors: Record<string, string> = {
  low: "bg-zinc-600 text-zinc-300",
  medium: "bg-amber-700/80 text-amber-100",
  high: "bg-red-700/80 text-red-100",
  critical: "bg-red-900 text-red-100",
};

// Quick actions per column status
function getQuickActions(status: TaskStatus): { label: string; target: TaskStatus; icon: typeof Play }[] {
  switch (status) {
    case "ready":
      return [
        { label: "Start", target: "in_progress", icon: Play },
        { label: "Backlog", target: "backlog", icon: RotateCcw },
      ];
    case "in_progress":
      return [
        { label: "Review", target: "review", icon: ArrowRight },
        { label: "Pause", target: "paused", icon: Pause },
      ];
    case "review":
      return [
        { label: "Done", target: "completed", icon: CheckCircle },
        { label: "Back", target: "in_progress", icon: RotateCcw },
      ];
    case "paused":
      return [
        { label: "Resume", target: "in_progress", icon: Play },
      ];
    case "blocked":
      return [
        { label: "Unblock", target: "ready", icon: Play },
      ];
    case "backlog":
      return [
        { label: "Ready", target: "ready", icon: ArrowRight },
      ];
    case "completed":
      return [
        { label: "Archive", target: "archived", icon: Archive },
      ];
    default:
      return [];
  }
}

export function TaskCard({ task, columnStatus, agents, onDragStart, onEdit, onDelete, onMoveTask, onDispatchTask }: TaskCardProps) {
  const priority = priorityColors[task.priority] || priorityColors.medium;
  const quickActions = getQuickActions(columnStatus);
  const canDispatch = agents && agents.length > 0 && onDispatchTask && ["ready", "intake", "backlog"].includes(columnStatus);

  return (
    <Card
      className="bg-zinc-800 border-zinc-700 cursor-grab active:cursor-grabbing hover:border-zinc-600 transition-colors"
      draggable
      onDragStart={onDragStart}
    >
      <CardContent className="p-2.5 space-y-1.5">
        {/* Title & Menu */}
        <div className="flex items-start justify-between gap-1">
          <h4 className="text-xs font-medium text-zinc-100 leading-tight flex-1 line-clamp-2">
            {task.title}
          </h4>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 text-zinc-500 hover:text-zinc-100 shrink-0"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zinc-800 border-zinc-700">
              <DropdownMenuItem onClick={onEdit} className="text-zinc-300 focus:bg-zinc-700 text-xs">
                <Pencil className="w-3 h-3 mr-2" /> Edit
              </DropdownMenuItem>
              
              {/* Dispatch to Agent submenu */}
              {canDispatch && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="text-zinc-300 focus:bg-zinc-700 text-xs">
                    <Send className="w-3 h-3 mr-2" /> Dispatch to Agent
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="bg-zinc-800 border-zinc-700">
                    {agents.map((agent) => (
                      <DropdownMenuItem
                        key={agent.id}
                        onClick={() => onDispatchTask!(task.id, agent.id)}
                        className="text-zinc-300 focus:bg-zinc-700 text-xs"
                      >
                        <Bot className="w-3 h-3 mr-2" />
                        {agent.name} ({agent.id})
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}

              {onMoveTask && (
                <>
                  <DropdownMenuSeparator className="bg-zinc-700" />
                  {[
                    { id: "ready" as TaskStatus, label: "→ Ready" },
                    { id: "in_progress" as TaskStatus, label: "→ In Progress" },
                    { id: "review" as TaskStatus, label: "→ Review" },
                    { id: "completed" as TaskStatus, label: "→ Completed" },
                    { id: "backlog" as TaskStatus, label: "→ Backlog" },
                    { id: "paused" as TaskStatus, label: "→ Paused" },
                  ]
                    .filter(s => s.id !== columnStatus)
                    .map(s => (
                      <DropdownMenuItem
                        key={s.id}
                        onClick={() => onMoveTask(task.id, s.id)}
                        className="text-zinc-300 focus:bg-zinc-700 text-xs"
                      >
                        {s.label}
                      </DropdownMenuItem>
                    ))}
                </>
              )}
              <DropdownMenuSeparator className="bg-zinc-700" />
              <DropdownMenuItem onClick={onDelete} className="text-red-400 focus:bg-zinc-700 text-xs">
                <Trash2 className="w-3 h-3 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Description (truncated) */}
        {task.description && (
          <p className="text-[11px] text-zinc-500 line-clamp-1">{task.description}</p>
        )}

        {/* Compact badges row */}
        <div className="flex items-center gap-1 flex-wrap">
          <Badge className={cn("text-[10px] px-1 py-0 h-4", priority)}>
            {task.priority}
          </Badge>
          {task.assignedTo && (
            <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 bg-zinc-700 text-zinc-300">
              <Bot className="w-2.5 h-2.5 mr-0.5" />
              {task.assignedTo}
            </Badge>
          )}
          {task.type === "auto" && (
            <Badge className="text-[10px] px-1 py-0 h-4 bg-purple-700/60 text-purple-200">auto</Badge>
          )}
        </div>

        {/* Tags (compact) */}
        {task.tags && task.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {task.tags
              .map(tag => tag.replace(/[\[\]"]/g, '').trim())
              .filter(tag => tag.length > 0)
              .slice(0, 3)
              .map((tag) => (
                <span key={tag} className="text-[10px] px-1 py-0 bg-zinc-700/50 text-zinc-500 rounded">
                  {tag}
                </span>
              ))}
            {task.tags.length > 3 && (
              <span className="text-[10px] text-zinc-600">+{task.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Quick action buttons */}
        <div className="flex gap-1 pt-0.5">
          {quickActions.length > 0 && onMoveTask && quickActions.map((action) => (
            <Button
              key={action.target}
              variant="secondary"
              size="sm"
              className="h-5 text-[10px] px-1.5 bg-zinc-700/50 hover:bg-zinc-600 text-zinc-300"
              onClick={(e) => {
                e.stopPropagation();
                onMoveTask(task.id, action.target);
              }}
            >
              <action.icon className="w-2.5 h-2.5 mr-0.5" />
              {action.label}
            </Button>
          ))}
          {/* Dispatch button for ready tasks */}
          {canDispatch && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-5 text-[10px] px-1.5 bg-orange-700/50 hover:bg-orange-600 text-orange-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Send className="w-2.5 h-2.5 mr-0.5" />
                  Dispatch
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-zinc-800 border-zinc-700">
                {agents.map((agent) => (
                  <DropdownMenuItem
                    key={agent.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDispatchTask!(task.id, agent.id);
                    }}
                    className="text-zinc-300 focus:bg-zinc-700 text-xs"
                  >
                    <Bot className="w-3 h-3 mr-2" />
                    {agent.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
