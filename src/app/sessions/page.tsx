"use client";

import { useEffect, useState, useCallback } from "react";
import { useSessionsStore } from "@/stores/sessions";
import { Session } from "@/types";
import { SessionTable } from "@/components/sessions/SessionTable";
import { SessionDetail } from "@/components/sessions/SessionDetail";
import { CompactionPolicies } from "@/components/sessions/CompactionPolicies";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Wifi, WifiOff, Loader2 } from "lucide-react";
import { useGateway } from "@/providers/GatewayProvider";
import { cn } from "@/lib/utils";

export default function SessionsPage() {
  const { sessions, setSessions, loading, setLoading } = useSessionsStore();
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const { connected, connecting, request, subscribe } = useGateway();

  const fetchSessions = useCallback(async () => {
    if (!connected) return;
    
    setLoading(true);
    setError(null);
    try {
      const result = await request<{ sessions: Session[] }>("sessions.list", { 
        limit: 100
      });
      
      if (result?.sessions) {
        // Normalize sessions data from raw gateway format if needed
        const normalized = result.sessions.map(s => {
          if (!s.tokens && ((s as any).totalTokens !== undefined || (s as any).inputTokens !== undefined)) {
            const used = (s as any).totalTokens ?? (((s as any).inputTokens || 0) + ((s as any).outputTokens || 0));
            const limit = (s as any).contextTokens ?? 200000;
            return {
              ...s,
              tokens: {
                used,
                limit,
                input: (s as any).inputTokens || 0,
                output: (s as any).outputTokens || 0
              }
            };
          }
          return s;
        });
        setSessions(normalized);
      }
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch sessions");
    } finally {
      setLoading(false);
    }
  }, [connected, request, setSessions, setLoading]);

  // Fetch sessions when connected
  useEffect(() => {
    if (connected) {
      fetchSessions();
    }
  }, [connected, fetchSessions]);

  // Subscribe to session events for live updates
  useEffect(() => {
    if (!connected) return;

    // Subscribe to agent events (sessions change when agents run)
    const unsubAgent = subscribe("agent", (payload) => {
      // Refresh sessions when agent activity happens
      if (payload.event === "run.end" || payload.event === "run.start") {
        setTimeout(fetchSessions, 500);
      }
    });

    // Subscribe to session events if available
    const unsubSession = subscribe("session", (payload) => {
      console.log("[Sessions] Session event:", payload);
      fetchSessions();
    });

    return () => {
      unsubAgent();
      unsubSession();
    };
  }, [connected, subscribe, fetchSessions]);

  const handleSelectSession = (session: Session) => {
    setSelectedSession(session);
  };

  const handleCloseDetail = () => {
    setSelectedSession(null);
  };

  // Connection status indicator
  const connectionStatus = connected ? "connected" : connecting ? "connecting" : "disconnected";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-zinc-100">Sessions</h1>
          {/* Connection indicator */}
          <Badge
            variant="outline"
            className={cn(
              "text-xs",
              connectionStatus === "connected"
                ? "border-emerald-500/50 text-emerald-400"
                : connectionStatus === "connecting"
                ? "border-yellow-500/50 text-yellow-400"
                : "border-red-500/50 text-red-400"
            )}
          >
            {connectionStatus === "connected" ? (
              <Wifi className="w-3 h-3 mr-1" />
            ) : connectionStatus === "connecting" ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <WifiOff className="w-3 h-3 mr-1" />
            )}
            {connectionStatus === "connected" 
              ? "Live" 
              : connectionStatus === "connecting" 
              ? "Connecting" 
              : "Offline"}
          </Badge>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={fetchSessions}
          disabled={loading || !connected}
          className="bg-zinc-800 hover:bg-zinc-700"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {!connected && !connecting && (
        <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4 text-yellow-400">
          Not connected to gateway. Session actions are disabled.
        </div>
      )}

      {/* Compaction Policies */}
      <CompactionPolicies sessions={sessions} onRefresh={fetchSessions} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={selectedSession ? "lg:col-span-2" : "lg:col-span-3"}>
          <SessionTable
            sessions={sessions}
            loading={loading}
            onSelectSession={handleSelectSession}
            selectedSessionKey={selectedSession?.key}
            onRefresh={fetchSessions}
          />
        </div>

        {selectedSession && (
          <div className="lg:col-span-1">
            <SessionDetail
              session={selectedSession}
              onClose={handleCloseDetail}
            />
          </div>
        )}
      </div>
    </div>
  );
}
