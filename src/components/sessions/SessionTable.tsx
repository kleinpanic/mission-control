"use client";

import { useState } from "react";
import { Session } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  MessageSquare, 
  Clock, 
  Database, 
  Trash2, 
  RefreshCw, 
  AlertTriangle, 
  Cpu,
  Minimize2,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useGateway } from "@/providers/GatewayProvider";

// Model token limits (context windows)
const MODEL_TOKEN_LIMITS: Record<string, number> = {
  "claude-opus-4": 200000,
  "claude-sonnet-4": 200000,
  "claude-sonnet-4-5": 200000,
  "claude-opus-4-5": 200000,
  "claude-3-opus": 200000,
  "claude-3-sonnet": 200000,
  "claude-3-haiku": 200000,
  "gpt-4o": 128000,
  "gpt-4o-mini": 128000,
  "gpt-4-turbo": 128000,
  "gpt-4": 8192,
  "gpt-5": 200000,
  "gpt-5.2": 200000,
  "gemini-pro": 1000000,
  "gemini-1.5-pro": 1000000,
  "gemini-1.5-flash": 1000000,
  "gemini-2.0-flash": 1000000,
  "gemini-3-flash": 1000000,
  "gemini-3-flash-preview": 1000000,
  "o1": 200000,
  "o1-mini": 128000,
  "o1-preview": 128000,
  "o3": 200000,
  "o3-mini": 200000,
};

function getModelLimit(model: string): number | null {
  // Try exact match
  if (MODEL_TOKEN_LIMITS[model]) {
    return MODEL_TOKEN_LIMITS[model];
  }
  // Try partial match
  for (const [key, limit] of Object.entries(MODEL_TOKEN_LIMITS)) {
    if (model.toLowerCase().includes(key.toLowerCase())) {
      return limit;
    }
  }
  return null;
}

interface SessionTableProps {
  sessions: Session[];
  loading: boolean;
  onSelectSession: (session: Session) => void;
  selectedSessionKey?: string;
  onRefresh?: () => void;
}

function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

function getAgentFromKey(key: string): string {
  const parts = key.split(":");
  return parts[1] || "unknown";
}

function getChannelFromKey(key: string): string {
  const parts = key.split(":");
  return parts[2] || "direct";
}

function formatTokenLimit(limit: number): string {
  if (limit >= 1000000) {
    return `${(limit / 1000000).toFixed(0)}M`;
  }
  if (limit >= 1000) {
    return `${(limit / 1000).toFixed(0)}K`;
  }
  return limit.toString();
}

export function SessionTable({
  sessions,
  loading,
  onSelectSession,
  selectedSessionKey,
  onRefresh,
}: SessionTableProps) {
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const { connected, request } = useGateway();

  const handleCompact = async (e: React.MouseEvent, session: Session) => {
    e.stopPropagation();
    
    if (!connected) {
      toast.error("Not connected to gateway");
      return;
    }
    
    setActionInProgress(`compact-${session.key}`);
    
    try {
      const result = await request("sessions.compact", { sessionKey: session.key });
      
      if (result) {
        const saved = result.tokensSaved || result.saved || 0;
        toast.success(`Session compacted! Saved ${saved.toLocaleString()} tokens`);
        onRefresh?.();
      } else {
        toast.success("Session compacted successfully");
        onRefresh?.();
      }
    } catch (error) {
      console.error("Failed to compact session:", error);
      toast.error(error instanceof Error ? error.message : "Failed to compact session");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReset = async (e: React.MouseEvent, session: Session) => {
    e.stopPropagation();
    
    if (!connected) {
      toast.error("Not connected to gateway");
      return;
    }
    
    setActionInProgress(`reset-${session.key}`);
    
    try {
      await request("sessions.reset", { sessionKey: session.key });
      toast.success("Session reset successfully");
      onRefresh?.();
    } catch (error) {
      console.error("Failed to reset session:", error);
      toast.error(error instanceof Error ? error.message : "Failed to reset session");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, session: Session) => {
    e.stopPropagation();
    
    if (!connected) {
      toast.error("Not connected to gateway");
      return;
    }
    
    setActionInProgress(`delete-${session.key}`);
    
    try {
      await request("sessions.delete", { sessionKey: session.key });
      toast.success("Session deleted");
      onRefresh?.();
    } catch (error) {
      console.error("Failed to delete session:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete session");
    } finally {
      setActionInProgress(null);
    }
  };

  const atCapacitySessions = sessions.filter(s => 
    s.tokens && Math.round((s.tokens.used / s.tokens.limit) * 100) >= 95
  ).length;

  if (loading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-100">Active Sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 bg-zinc-800" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (sessions.length === 0) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-100">Active Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-zinc-500">
            <MessageSquare className="w-8 h-8 mr-2 opacity-50" />
            No active sessions
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg text-zinc-100">
              Active Sessions ({sessions.length})
            </CardTitle>
            {atCapacitySessions > 0 && (
              <CardDescription className="flex items-center gap-1 text-amber-400 mt-1">
                <AlertTriangle className="w-3 h-3" />
                {atCapacitySessions} session{atCapacitySessions > 1 ? 's' : ''} at capacity
              </CardDescription>
            )}
          </div>
          {!connected && (
            <Badge variant="outline" className="text-yellow-400 border-yellow-400/50">
              Offline
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {sessions.map((session) => {
          const agent = getAgentFromKey(session.key);
          const channel = getChannelFromKey(session.key);
          const contextPercent = session.tokens 
            ? Math.round((session.tokens.used / session.tokens.limit) * 100)
            : 0;
          const isSelected = session.key === selectedSessionKey;
          const modelLimit = getModelLimit(session.model || '');
          const isCompacting = actionInProgress === `compact-${session.key}`;
          const isResetting = actionInProgress === `reset-${session.key}`;
          const isDeleting = actionInProgress === `delete-${session.key}`;
          const isAnyAction = isCompacting || isResetting || isDeleting;

          return (
            <div
              key={session.key}
              className={cn(
                "p-3 rounded-lg cursor-pointer transition-colors",
                isSelected
                  ? "bg-zinc-700 border border-zinc-600"
                  : "bg-zinc-800/50 hover:bg-zinc-800"
              )}
              onClick={() => onSelectSession(session)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-100">{agent}</span>
                    <Badge
                      variant="secondary"
                      className="text-xs bg-zinc-700 text-zinc-300"
                    >
                      {channel}
                    </Badge>
                    {session.kind === "group" && (
                      <Badge
                        variant="secondary"
                        className="text-xs bg-blue-900/50 text-blue-400"
                      >
                        Group
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1 text-zinc-500 text-xs">
                      <Cpu className="w-3 h-3" />
                      <span className="font-mono">{session.model || 'default'}</span>
                    </div>
                    <span className="text-zinc-600">•</span>
                    <span className="text-zinc-500 text-xs">
                      {session.tokens?.limit.toLocaleString() || 'N/A'} tokens
                      {modelLimit && session.tokens && modelLimit !== session.tokens.limit && (
                        <span className="text-zinc-600"> (model: {formatTokenLimit(modelLimit)})</span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-zinc-400">
                      <Database className="w-3 h-3" />
                      <span>{contextPercent}%</span>
                    </div>
                    <div className="flex items-center gap-1 text-zinc-500 text-xs">
                      <Clock className="w-3 h-3" />
                      {session.lastActivity ? formatRelativeTime(session.lastActivity) : 'Never'}
                    </div>
                  </div>

                  {/* Actions Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={(e) => e.stopPropagation()}
                        disabled={isAnyAction || !connected}
                      >
                        {isAnyAction ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <MoreHorizontal className="w-4 h-4" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-700">
                      <DropdownMenuItem 
                        onClick={(e) => handleCompact(e as any, session)}
                        className="text-zinc-200 focus:bg-zinc-800 focus:text-zinc-100"
                        disabled={isCompacting}
                      >
                        <Minimize2 className="w-4 h-4 mr-2" />
                        Compact Session
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => handleReset(e as any, session)}
                        className="text-zinc-200 focus:bg-zinc-800 focus:text-zinc-100"
                        disabled={isResetting}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Reset Session
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-zinc-700" />
                      <DropdownMenuItem 
                        onClick={(e) => handleDelete(e as any, session)}
                        className="text-red-400 focus:bg-red-900/20 focus:text-red-400"
                        disabled={isDeleting}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Session
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Quick compact button when at capacity */}
                  {contextPercent >= 80 && (
                    <Button
                      size="sm"
                      variant={contextPercent >= 95 ? "destructive" : "secondary"}
                      className={cn(
                        "h-7 px-2",
                        contextPercent >= 95 
                          ? "" 
                          : "bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400"
                      )}
                      onClick={(e) => handleCompact(e, session)}
                      disabled={isCompacting || !connected}
                    >
                      {isCompacting ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Minimize2 className="w-3 h-3" />
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {/* Context bar */}
              <div className="mt-2 h-1 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    contextPercent > 80
                      ? "bg-red-500"
                      : contextPercent > 50
                      ? "bg-yellow-500"
                      : "bg-green-500"
                  )}
                  style={{ width: `${contextPercent}%` }}
                />
              </div>

              {/* Compactions indicator */}
              {(session.compactions || 0) > 0 && (
                <div className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
                  <Minimize2 className="w-3 h-3" />
                  {session.compactions || 0} previous compaction{(session.compactions || 0) > 1 ? 's' : ''}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
