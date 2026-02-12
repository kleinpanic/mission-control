"use client";

import { useState } from "react";
import { Agent } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Bot,
  Clock,
  MessageSquare,
  Activity,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Send,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentDetail } from "./AgentDetail";

interface AgentCardProps {
  agent: Agent;
}

const statusConfig = {
  active: {
    color: "bg-green-500",
    textColor: "text-green-400",
    label: "Active",
  },
  idle: {
    color: "bg-zinc-500",
    textColor: "text-zinc-400",
    label: "Idle",
  },
  error: {
    color: "bg-red-500",
    textColor: "text-red-400",
    label: "Error",
  },
};

function formatRelativeTime(timestamp: string | null): string {
  if (!timestamp) return "Never";
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

function formatHeartbeat(timestamp: string | null, overdue: boolean): string {
  if (!timestamp) return "—";
  const diff = new Date(timestamp).getTime() - Date.now();
  const minutes = Math.floor(diff / 60000);

  if (overdue || diff < 0) {
    return `Overdue by ${Math.abs(minutes)}m`;
  }
  return `${minutes}m`;
}

export function AgentCard({ agent }: AgentCardProps) {
  const [expanded, setExpanded] = useState(false);
  const status = statusConfig[agent.status];

  const contextPercentage = agent.activeSession
    ? Math.round(Math.random() * 100) // TODO: Get actual context usage
    : 0;

  return (
    <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="p-2 bg-zinc-800 rounded-lg">
                <Bot className="w-5 h-5 text-zinc-400" />
              </div>
              <div
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-900",
                  status.color
                )}
              />
            </div>
            <div>
              <CardTitle className="text-base text-zinc-100">
                {agent.name || agent.id}
              </CardTitle>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge
                  variant="secondary"
                  className={cn("text-xs", status.textColor, "bg-zinc-800")}
                >
                  {status.label}
                </Badge>
                {agent.model && (
                  <span className="text-xs text-zinc-500">{agent.model}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2 text-zinc-400">
            <Activity className="w-4 h-4" />
            <span>{formatRelativeTime(agent.lastActivity)}</span>
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <Clock className="w-4 h-4" />
            <span
              className={cn(
                agent.heartbeatOverdue && "text-yellow-500"
              )}
            >
              ♡ {formatHeartbeat(agent.heartbeatNext, agent.heartbeatOverdue)}
            </span>
          </div>
        </div>

        {/* Context Usage */}
        {agent.activeSession && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Context Usage</span>
              <span className="text-zinc-400">{contextPercentage}%</span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  contextPercentage > 80
                    ? "bg-red-500"
                    : contextPercentage > 50
                    ? "bg-yellow-500"
                    : "bg-green-500"
                )}
                style={{ width: `${contextPercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4 mr-1" />
            ) : (
              <ChevronDown className="w-4 h-4 mr-1" />
            )}
            {expanded ? "Less" : "Details"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
          >
            <MessageSquare className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>

      {/* Expanded Detail */}
      {expanded && <AgentDetail agent={agent} />}
    </Card>
  );
}
