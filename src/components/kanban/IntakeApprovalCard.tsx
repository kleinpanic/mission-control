"use client";

import { Task } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, AlertTriangle, Brain, Bot, Clock, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface IntakeApprovalCardProps {
  task: Task;
  onAccept: () => void;
  onReject: () => void;
  onEdit: () => void;
}

const priorityConfig: Record<string, { color: string }> = {
  low: { color: "bg-zinc-600 text-zinc-300" },
  medium: { color: "bg-yellow-600 text-yellow-100" },
  high: { color: "bg-red-600 text-red-100" },
  critical: { color: "bg-red-800 text-red-100" },
};

const complexityConfig: Record<string, { color: string }> = {
  trivial: { color: "bg-green-600 text-green-100" },
  simple: { color: "bg-cyan-600 text-cyan-100" },
  moderate: { color: "bg-yellow-600 text-yellow-100" },
  complex: { color: "bg-orange-600 text-orange-100" },
  epic: { color: "bg-red-600 text-red-100" },
};

const dangerConfig: Record<string, { color: string }> = {
  safe: { color: "bg-green-600 text-green-100" },
  low: { color: "bg-cyan-600 text-cyan-100" },
  medium: { color: "bg-yellow-600 text-yellow-100" },
  high: { color: "bg-orange-600 text-orange-100" },
  critical: { color: "bg-red-600 text-red-100" },
};

export function IntakeApprovalCard({ task, onAccept, onReject, onEdit }: IntakeApprovalCardProps) {
  const priority = priorityConfig[task.priority];
  const complexity = task.complexity ? complexityConfig[task.complexity] : null;
  const danger = task.danger ? dangerConfig[task.danger] : null;

  return (
    <Card className="bg-zinc-800 border-2 border-purple-500/50 hover:border-purple-500 transition-colors">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-semibold text-zinc-100 flex-1">{task.title}</h4>
          <Badge className="bg-purple-600 text-purple-100 text-xs">INTAKE</Badge>
        </div>

        {/* Description */}
        {task.description && (
          <p className="text-xs text-zinc-300 line-clamp-3">{task.description}</p>
        )}

        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={cn("text-xs", priority.color)}>{task.priority}</Badge>
          {complexity && (
            <Badge className={cn("text-xs flex items-center gap-1", complexity.color)}>
              <Brain className="w-3 h-3" />
              {task.complexity}
            </Badge>
          )}
          {danger && (
            <Badge className={cn("text-xs flex items-center gap-1", danger.color)}>
              <AlertTriangle className="w-3 h-3" />
              {task.danger}
            </Badge>
          )}
        </div>

        {/* Detail Score & Model */}
        {(task.detailScore !== undefined || task.recommendedModel) && (
          <div className="flex items-center gap-3 flex-wrap text-xs">
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
                {task.recommendedModel.split('/').pop()}
              </Badge>
            )}
          </div>
        )}

        {/* Assigned To */}
        {task.assignedTo && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <Bot className="w-3 h-3" />
            <span>Proposed for: <span className="text-zinc-200">{task.assignedTo}</span></span>
          </div>
        )}

        {/* Due Date & Estimate */}
        {(task.dueDate || task.estimatedMinutes) && (
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

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2 border-t border-zinc-700">
          <Button
            onClick={onAccept}
            size="sm"
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          >
            <Check className="w-4 h-4 mr-1" />
            Accept → Ready
          </Button>
          <Button
            onClick={onReject}
            size="sm"
            variant="outline"
            className="flex-1 border-red-600 text-red-400 hover:bg-red-950"
          >
            <X className="w-4 h-4 mr-1" />
            Reject → Archived
          </Button>
          <Button
            onClick={onEdit}
            size="sm"
            variant="ghost"
            className="text-zinc-400 hover:text-zinc-100"
          >
            Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
