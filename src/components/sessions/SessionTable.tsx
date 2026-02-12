"use client";

import { useState } from "react";
import { Session } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Clock, Database, Trash2, RefreshCw, AlertTriangle, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SessionTableProps {
  sessions: Session[];
  loading: boolean;
  onSelectSession: (session: Session) => void;
  selectedSessionKey?: string;
  onRefresh?: () => void;
}

async function handleSessionAction(action: string, sessionKey: string, agentId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, sessionKey, agentId }),
    });
    const data = await res.json();
    return data.success !== false;
  } catch (error) {
    console.error('Session action failed:', error);
    return false;
  }
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

export function SessionTable({
  sessions,
  loading,
  onSelectSession,
  selectedSessionKey,
  onRefresh,
}: SessionTableProps) {
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const handlePrune = async (e: React.MouseEvent, session: Session) => {
    e.stopPropagation();
    const agent = getAgentFromKey(session.key);
    setActionInProgress(session.key);
    
    const success = await handleSessionAction('reset', session.key, agent);
    if (success) {
      toast.success('Session pruned successfully');
      onRefresh?.();
    } else {
      toast.error('Failed to prune session');
    }
    setActionInProgress(null);
  };

  const atCapacitySessions = sessions.filter(s => 
    Math.round((s.tokens.used / s.tokens.limit) * 100) >= 95
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
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {sessions.map((session) => {
          const agent = getAgentFromKey(session.key);
          const channel = getChannelFromKey(session.key);
          const contextPercent = Math.round(
            (session.tokens.used / session.tokens.limit) * 100
          );
          const isSelected = session.key === selectedSessionKey;

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
                      {session.tokens.limit.toLocaleString()} max tokens
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
                      {formatRelativeTime(session.lastActivity)}
                    </div>
                  </div>
                  {contextPercent >= 95 && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 px-2"
                      onClick={(e) => handlePrune(e, session)}
                      disabled={actionInProgress === session.key}
                    >
                      {actionInProgress === session.key ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
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
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
