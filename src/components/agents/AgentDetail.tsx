"use client";

import { useState, useEffect, useCallback } from "react";
import { Agent, Session } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useGateway } from "@/providers/GatewayProvider";
import {
  Send,
  RefreshCw,
  Minimize2,
  Trash2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AgentDetailProps {
  agent: Agent;
}

export function AgentDetail({ agent }: AgentDetailProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [agentSessions, setAgentSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const { connected, request } = useGateway();

  // Fetch sessions for this agent from gateway
  const fetchSessions = useCallback(async () => {
    if (!connected) return;

    setLoadingSessions(true);
    try {
      const result = await request<any>("sessions.list", { limit: 100 });
      if (result?.sessions) {
        const filtered = result.sessions.filter((s: any) => {
          const parts = (s.key || "").split(":");
          const sessionAgentId = s.agentId || parts[1] || "";
          return sessionAgentId === agent.id;
        });

        // Normalize token data
        const normalized = filtered.map((s: any) => {
          if (
            !s.tokens &&
            ((s as any).totalTokens !== undefined ||
              (s as any).inputTokens !== undefined)
          ) {
            const used =
              (s as any).totalTokens ??
              ((s as any).inputTokens || 0) + ((s as any).outputTokens || 0);
            const limit = (s as any).contextTokens ?? 200000;
            return {
              ...s,
              tokens: {
                used,
                limit,
                input: (s as any).inputTokens || 0,
                output: (s as any).outputTokens || 0,
              },
            };
          }
          return s;
        });

        setAgentSessions(normalized);
      }
    } catch (err) {
      console.error("Failed to fetch sessions for agent:", err);
    } finally {
      setLoadingSessions(false);
    }
  }, [connected, request, agent.id]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleSendMessage = async () => {
    if (!message.trim() || !connected) return;

    setSending(true);
    try {
      await request("send", {
        to: agent.id,
        message: message.trim(),
      });
      toast.success(`Message sent to ${agent.name || agent.id}`);
      setMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to send message"
      );
    } finally {
      setSending(false);
    }
  };

  const handleResetSession = async (sessionKey: string) => {
    if (!connected) return;
    setActionInProgress(`reset-${sessionKey}`);
    try {
      await request("sessions.reset", { key: sessionKey });
      toast.success("Session reset");
      fetchSessions();
    } catch (error) {
      console.error("Failed to reset session:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to reset session"
      );
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDeleteSession = async (sessionKey: string) => {
    if (!connected) return;
    setActionInProgress(`delete-${sessionKey}`);
    try {
      await request("sessions.delete", { key: sessionKey });
      toast.success("Session deleted");
      fetchSessions();
    } catch (error) {
      console.error("Failed to delete session:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete session"
      );
    } finally {
      setActionInProgress(null);
    }
  };

  const handleCompactSession = async (sessionKey: string) => {
    if (!connected) return;
    setActionInProgress(`compact-${sessionKey}`);
    try {
      await request("sessions.compact", { key: sessionKey });
      toast.success("Session compacted");
      fetchSessions();
    } catch (error) {
      console.error("Failed to compact session:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to compact session"
      );
    } finally {
      setActionInProgress(null);
    }
  };

  const getSessionLabel = (key: string): string => {
    const parts = key.split(":");
    // e.g. "agent:dev:main" → "main", "cron:dev:heartbeat-xxx" → "heartbeat-xxx"
    if (parts.length >= 3) return parts.slice(2).join(":");
    return key;
  };

  const getUsagePercent = (session: Session): number => {
    if (!session.tokens?.used || !session.tokens?.limit) return 0;
    return Math.round((session.tokens.used / session.tokens.limit) * 100);
  };

  return (
    <div className="border-t border-zinc-800 bg-zinc-800/30 p-4 space-y-4">
      {/* Sessions List */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-zinc-300">
            Sessions ({agentSessions.length})
          </h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchSessions}
            disabled={loadingSessions}
            className="h-6 w-6 p-0 text-zinc-400"
          >
            <RefreshCw
              className={cn("w-3 h-3", loadingSessions && "animate-spin")}
            />
          </Button>
        </div>
        {loadingSessions && agentSessions.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-zinc-500 py-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            Loading sessions...
          </div>
        ) : agentSessions.length === 0 ? (
          <p className="text-sm text-zinc-500">No sessions found</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {agentSessions.map((session) => {
              const usagePct = getUsagePercent(session);
              const isActing = actionInProgress?.includes(session.key);
              return (
                <div
                  key={session.key}
                  className="p-2 bg-zinc-800/50 rounded text-sm space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-zinc-300 truncate font-mono text-xs flex-1 mr-2">
                      {getSessionLabel(session.key)}
                    </p>
                    {session.model && (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-zinc-600 text-zinc-400 shrink-0"
                      >
                        {(session.model || "").split("/").pop()}
                      </Badge>
                    )}
                  </div>

                  {/* Token usage bar */}
                  {session.tokens && (
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-[10px] text-zinc-500">
                        <span>
                          {(session.tokens.used || 0).toLocaleString()} /{" "}
                          {(session.tokens.limit || 0).toLocaleString()}
                        </span>
                        <span>{usagePct}%</span>
                      </div>
                      <div className="h-1 bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            usagePct > 80
                              ? "bg-red-500"
                              : usagePct > 50
                              ? "bg-yellow-500"
                              : "bg-emerald-500"
                          )}
                          style={{ width: `${Math.min(usagePct, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Session actions */}
                  <div className="flex gap-1 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px] text-zinc-400 hover:text-zinc-200"
                      onClick={() => handleCompactSession(session.key)}
                      disabled={!!isActing || !connected}
                      title="Compact session"
                    >
                      <Minimize2 className="w-3 h-3 mr-1" />
                      Compact
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px] text-zinc-400 hover:text-zinc-200"
                      onClick={() => handleResetSession(session.key)}
                      disabled={!!isActing || !connected}
                      title="Reset session"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Reset
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px] text-red-400 hover:text-red-300"
                      onClick={() => handleDeleteSession(session.key)}
                      disabled={!!isActing || !connected}
                      title="Delete session"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Send Message */}
      <div>
        <h4 className="text-sm font-medium text-zinc-300 mb-2">
          Send Message
        </h4>
        <div className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={`Message ${agent.name || agent.id}...`}
            className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!message.trim() || sending || !connected}
            className="bg-orange-600 hover:bg-orange-700 text-white h-9"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
