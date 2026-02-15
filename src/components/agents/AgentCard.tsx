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
  MoreVertical,
  RefreshCw,
  Settings,
  Minimize2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { AgentDetail } from "./AgentDetail";
import { toast } from "sonner";
import { useGateway } from "@/providers/GatewayProvider";

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
  waiting: {
    color: "bg-yellow-500",
    textColor: "text-yellow-400",
    label: "Waiting",
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

function formatHeartbeat(value: string | null, overdue: boolean): string {
  if (!value) return "—";
  
  // If it's already a relative time like "5m", just return it
  if (value.match(/^\d+[smh]$/)) {
    return overdue ? `Overdue by ${value}` : value;
  }

  // Otherwise try to parse as date
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;

  const diff = date.getTime() - Date.now();
  const minutes = Math.floor(diff / 60000);

  if (overdue || diff < 0) {
    return `Overdue by ${Math.abs(minutes)}m`;
  }
  return `${minutes}m`;
}

export function AgentCard({ agent }: AgentCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const { connected, request } = useGateway();
  const status = statusConfig[agent.status];

  const contextPercentage = Math.round(agent.contextUsagePercent || 0);

  const handleTriggerHeartbeat = async () => {
    if (!connected) {
      toast.error("Not connected to gateway");
      return;
    }
    
    setActionInProgress("heartbeat");
    try {
      // Use the 'wake' method to trigger a heartbeat for the agent
      await request("wake", { agentId: agent.id, mode: "now" });
      toast.success(`Heartbeat triggered for ${agent.name || agent.id}`);
    } catch (error) {
      console.error("Failed to trigger heartbeat:", error);
      toast.error(error instanceof Error ? error.message : "Failed to trigger heartbeat");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleCompactSessions = async () => {
    if (!connected) {
      toast.error("Not connected to gateway");
      return;
    }
    
    setActionInProgress("compact");
    try {
      // Get all sessions for this agent and compact each one
      const result = await request<any>("sessions.list", { limit: 100 });
      const agentSessions = (result?.sessions || []).filter((s: any) => {
        const parts = (s.key || "").split(":");
        return (s.agentId || parts[1]) === agent.id;
      });
      
      let compacted = 0;
      let failed = 0;
      for (const session of agentSessions) {
        try {
          await request("sessions.compact", { key: session.key });
          compacted++;
        } catch {
          failed++;
        }
      }
      
      if (compacted > 0) {
        toast.success(`Compacted ${compacted} session${compacted !== 1 ? "s" : ""} for ${agent.name || agent.id}`);
      }
      if (failed > 0) {
        toast.error(`Failed to compact ${failed} session${failed !== 1 ? "s" : ""}`);
      }
      if (compacted === 0 && failed === 0) {
        toast.info("No sessions to compact");
      }
    } catch (error) {
      console.error("Failed to compact sessions:", error);
      toast.error(error instanceof Error ? error.message : "Failed to compact sessions");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleConfigPatch = async () => {
    toast.info("Config patch UI coming soon");
  };

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
                {agent.name && agent.name !== agent.id && (
                  <span className="text-xs text-zinc-500 font-mono">{agent.id}</span>
                )}
                <Badge
                  variant="secondary"
                  className={cn("text-xs", status.textColor, "bg-zinc-800")}
                >
                  {status.label}
                </Badge>
                {agent.model && (
                  <span className="text-xs text-zinc-500 flex items-center gap-1">
                    {agent.authMode && agent.authMode !== "unknown" && (
                      <span className={cn("text-[9px] px-1 rounded font-medium",
                        agent.authMode === "oauth" ? "bg-emerald-500/20 text-emerald-400" :
                        agent.authMode === "api" || agent.authMode === "token" ? "bg-amber-500/20 text-amber-400" :
                        agent.authMode === "local" ? "bg-blue-500/20 text-blue-400" :
                        "bg-zinc-500/20 text-zinc-400"
                      )}>
                        {agent.authMode === "oauth" ? "OAuth" :
                         agent.authMode === "api" || agent.authMode === "token" ? "API" :
                         agent.authMode === "local" ? "Local" : agent.authMode}
                      </span>
                    )}
                    {(agent.model || "").split("/").pop()}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Agent Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-100"
                disabled={!!actionInProgress || !connected}
              >
                {actionInProgress ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <MoreVertical className="w-4 h-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-700">
              <DropdownMenuItem 
                onClick={handleTriggerHeartbeat}
                className="text-zinc-200 focus:bg-zinc-800 focus:text-zinc-100"
                disabled={actionInProgress === "heartbeat"}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Trigger Heartbeat
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={handleCompactSessions}
                className="text-zinc-200 focus:bg-zinc-800 focus:text-zinc-100"
                disabled={actionInProgress === "compact"}
              >
                <Minimize2 className="w-4 h-4 mr-2" />
                Compact All Sessions
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-700" />
              <DropdownMenuItem 
                onClick={handleConfigPatch}
                className="text-zinc-200 focus:bg-zinc-800 focus:text-zinc-100"
              >
                <Settings className="w-4 h-4 mr-2" />
                Config Patch
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Waiting Status Badges */}
        {agent.status === "waiting" && (
          <div className="flex flex-wrap gap-2">
            {agent.tokenLimited && (
              <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                <AlertCircle className="w-3 h-3 mr-1" />
                Token Limited
              </Badge>
            )}
            {agent.rateLimited && (
              <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                <AlertCircle className="w-3 h-3 mr-1" />
                Rate Limited
              </Badge>
            )}
          </div>
        )}

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

        {/* Active Sessions */}
        {(agent.activeSessions || 0) > 0 && (
          <div className="flex items-center justify-between text-sm py-1">
            <span className="text-zinc-500 flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              Active Sessions
            </span>
            <span className="text-zinc-300 font-medium">{agent.activeSessions}</span>
          </div>
        )}

        {/* Context Usage */}
        {contextPercentage > 0 && (
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
