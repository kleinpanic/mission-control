"use client";

import { useEffect, useState, useCallback } from "react";
import { useGateway } from "@/providers/GatewayProvider";
import { AgentCard } from "@/components/agents/AgentCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Agent } from "@/types";

// Well-known context windows by model (fallback when gateway doesn't report it)
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  "claude-sonnet-4-5": 200000,
  "claude-opus-4-5": 200000,
  "claude-opus-4-6": 200000,
  "gpt-5.2": 400000,
  "gemini-3-flash-preview": 1000000,
  "gemini-3-pro-preview": 2000000,
  "gemma2:2b": 8192,
  "phi3:mini": 4096,
  "qwen2.5:3b": 32768,
};

function lookupContextWindow(model: string | null): number {
  if (!model) return 200000;
  // Try exact match first, then suffix match
  if (MODEL_CONTEXT_WINDOWS[model]) return MODEL_CONTEXT_WINDOWS[model];
  const suffix = model.split("/").pop() || "";
  if (MODEL_CONTEXT_WINDOWS[suffix]) return MODEL_CONTEXT_WINDOWS[suffix];
  return 200000; // Default fallback
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const { connected, request, subscribe } = useGateway();

  const fetchAgents = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    try {
      // Use HTTP APIs exclusively — avoids WS operator.read scope errors
      const [agentsResult, statusResult] = await Promise.all([
        fetch("/api/agents").then(r => r.ok ? r.json() : null).catch(() => null),
        fetch("/api/status").then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      
      if (agentsResult || statusResult) {
        // Build maps from status data
        const sessionsByAgent = new Map<string, any[]>();
        const heartbeatByAgent = new Map<string, any>();
        
        if (statusResult) {
          // Map sessions by agent
          const allSessions = statusResult.sessions?.recent || [];
          for (const s of allSessions) {
            const agentId = s.agentId || "";
            if (!sessionsByAgent.has(agentId)) sessionsByAgent.set(agentId, []);
            sessionsByAgent.get(agentId)!.push(s);
          }
          
          // Map heartbeat info by agent
          statusResult.heartbeat?.agents?.forEach((hb: any) => {
            heartbeatByAgent.set(hb.agentId, hb);
          });
        }

        // Build next heartbeat map from status.heartbeat.nextHeartbeats
        const nextHeartbeatByAgent = new Map<string, any>();
        const nextHbs = statusResult?.heartbeat?.nextHeartbeats || statusResult?.heartbeat?.next || [];
        for (const hb of nextHbs) {
          nextHeartbeatByAgent.set(hb.agentId, hb);
        }
        
        // Use ONLY what the gateway returns — no hardcoded defaults
        const gatewayAgents = agentsResult?.agents || [];
        
        if (gatewayAgents.length === 0) {
          setAgents([]);
          return;
        }
        
        const fetchedAgents: Agent[] = gatewayAgents.map((agent: any) => {
          const sessions = sessionsByAgent.get(agent.id) || [];
          const heartbeatInfo = heartbeatByAgent.get(agent.id);
          const nextHb = nextHeartbeatByAgent.get(agent.id);
          
          // Find most recent activity
          let mostRecentSession = null;
          for (const session of sessions) {
            if (!mostRecentSession || (session.updatedAt || 0) > (mostRecentSession.updatedAt || 0)) {
              mostRecentSession = session;
            }
          }
          
          const lastActivityMs = mostRecentSession?.updatedAt;
          const lastActivity = lastActivityMs ? new Date(lastActivityMs).toISOString() : null;
          
          // Determine status
          const activeSessions = sessions.length;
          const recentActivity = lastActivityMs && (Date.now() - lastActivityMs < 5 * 60 * 1000);
          const hasTokenLimited = sessions.some((s: any) => s.state === "waiting" && s.reason?.includes("token"));
          const hasRateLimited = sessions.some((s: any) => s.state === "waiting" && s.reason?.includes("rate"));
          const hasWaiting = sessions.some((s: any) => s.percentUsed >= 95 || s.state === "waiting");
          
          let status: "active" | "idle" | "waiting" | "error" = "idle";
          if (hasTokenLimited || hasRateLimited || hasWaiting) {
            status = "waiting";
          } else if (recentActivity) {
            status = "active";
          }
          
          // Compute context usage properly
          // Use contextTokens from session if available, otherwise look up by model
          const contextUsages = sessions.map((s: any) => {
            const total = s.totalTokens || 0;
            const ctxLimit = s.contextTokens || lookupContextWindow(s.model);
            return ctxLimit > 0 ? (total / ctxLimit) * 100 : 0;
          });
          const maxContextUsage = contextUsages.length > 0 ? Math.max(...contextUsages, 0) : 0;

          // Heartbeat: prefer next heartbeat time, fall back to interval
          let heartbeatNext: string | null = null;
          if (nextHb?.nextIn) {
            heartbeatNext = nextHb.nextIn;
          } else if (heartbeatInfo?.every) {
            heartbeatNext = heartbeatInfo.every;
          }
          
          // Heartbeat interval — prefer agent API field, fall back to heartbeat config
          const agentHbInterval = agent.heartbeatInterval || null;
          const everyMs = heartbeatInfo?.everyMs || 0;
          const heartbeatInterval = agentHbInterval
            ? agentHbInterval
            : everyMs > 0
              ? everyMs >= 3600000 ? `${Math.round(everyMs / 3600000)}h`
              : everyMs >= 60000 ? `${Math.round(everyMs / 60000)}m`
              : `${Math.round(everyMs / 1000)}s`
              : heartbeatInfo?.enabled === false ? "disabled" : "disabled";

          return {
            id: agent.id,
            name: agent.name || agent.id,
            status,
            model: mostRecentSession?.model || agent.model || null,
            authMode: agent.authMode || "unknown",
            lastActivity,
            activeSession: mostRecentSession?.key || null,
            heartbeatNext,
            heartbeatInterval: heartbeatInterval || undefined,
            heartbeatOverdue: false,
            activeSessions,
            tokenLimited: hasTokenLimited,
            rateLimited: hasRateLimited,
            contextUsagePercent: maxContextUsage,
          };
        });

        setAgents(fetchedAgents);
      }
    } catch (error) {
      console.error("Failed to fetch agents:", error);
    } finally {
      if (!background) setLoading(false);
    }
  }, []); // HTTP-only — no WS dependency

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!connected) return;

    const unsubAgent = subscribe("agent", () => {
      fetchAgents(true); // background — no loading skeleton
    });

    const unsubSession = subscribe("session", () => {
      fetchAgents(true);
    });

    // Periodic background refresh (no loading skeleton)
    const interval = setInterval(() => fetchAgents(true), 30000);

    return () => {
      unsubAgent();
      unsubSession();
      clearInterval(interval);
    };
  }, [connected, subscribe, fetchAgents]);

  const activeCount = agents.filter((a) => a.status === "active").length;
  const waitingCount = agents.filter((a) => a.status === "waiting").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-100">Agents</h1>
        <span className="text-sm text-zinc-500">
          {agents.length === 0 && !loading && "No agents found"}
          {activeCount > 0 && `${activeCount} active`}
          {waitingCount > 0 && ` • ${waitingCount} waiting`}
          {activeCount === 0 && waitingCount === 0 && agents.length > 0 && `${agents.length} idle`}
        </span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 bg-zinc-800" />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          <p className="text-lg">No agents configured</p>
          <p className="text-sm mt-2">Connect to a gateway with configured agents to see them here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}
