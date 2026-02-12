"use client";

import { useEffect, useState, useCallback } from "react";
import { useGateway } from "@/providers/GatewayProvider";
import { AgentCard } from "@/components/agents/AgentCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Agent } from "@/types";

// Default agents based on Klein's setup
const DEFAULT_AGENTS = [
  { id: "main", name: "KleinClaw" },
  { id: "dev", name: "KleinClaw-Code" },
  { id: "ops", name: "Ops" },
  { id: "school", name: "School" },
  { id: "research", name: "Research" },
  { id: "meta", name: "Meta" },
];

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const { connected, request, subscribe } = useGateway();

  const fetchAgents = useCallback(async () => {
    if (!connected) return;
    
    setLoading(true);
    try {
      const [agentsResult, statusResult] = await Promise.all([
        request<any>("agents.list").catch(e => { console.error("agents.list error:", e); return null; }),
        request<any>("status").catch(e => { console.error("status error:", e); return null; }),
      ]);
      
      if (agentsResult && statusResult) {
        // Build a map of agent sessions from status
        const sessionsByAgent = new Map<string, any[]>();
        const heartbeatByAgent = new Map<string, any>();
        
        // Map sessions by agent
        statusResult.sessions?.byAgent?.forEach((agentSessions: any) => {
          sessionsByAgent.set(agentSessions.agentId, agentSessions.recent || []);
        });
        
        // Map heartbeat info by agent
        statusResult.heartbeat?.agents?.forEach((hb: any) => {
          heartbeatByAgent.set(hb.agentId, hb);
        });
        
        // Transform agents response to expected format
        const fetchedAgents: Agent[] = (agentsResult.agents || []).map((agent: any) => {
          const sessions = sessionsByAgent.get(agent.id) || [];
          const heartbeat = heartbeatByAgent.get(agent.id);
          
          // Find most recent activity
          let mostRecentSession = null;
          for (const session of sessions) {
            if (!mostRecentSession || (session.updatedAt || 0) > (mostRecentSession.updatedAt || 0)) {
              mostRecentSession = session;
            }
          }
          
          const lastActivityMs = mostRecentSession?.updatedAt;
          const lastActivity = lastActivityMs ? new Date(lastActivityMs).toISOString() : null;
          
          // Determine status based on session state and token/rate limits
          const activeSessions = sessions.length;
          const recentActivity = lastActivityMs && (Date.now() - lastActivityMs < 5 * 60 * 1000);
          
          // Check for waiting states from session data
          const hasTokenLimited = sessions.some((s: any) => s.state === "waiting" && s.reason?.includes("token"));
          const hasRateLimited = sessions.some((s: any) => s.state === "waiting" && s.reason?.includes("rate"));
          const hasWaiting = sessions.some((s: any) => s.percentUsed >= 95 || s.state === "waiting");
          
          let status: "active" | "idle" | "waiting" | "error" = "idle";
          if (hasTokenLimited || hasRateLimited || hasWaiting) {
            status = "waiting";
          } else if (recentActivity) {
            status = "active";
          }
          
          // Get next heartbeat
          const nextHeartbeat = statusResult.heartbeat?.next?.find((hb: any) => hb.agentId === agent.id);
          
          return {
            id: agent.id,
            name: agent.name || agent.id,
            status,
            model: mostRecentSession?.model || null,
            lastActivity,
            activeSession: mostRecentSession?.key || null,
            heartbeatNext: nextHeartbeat?.nextIn || null,
            heartbeatOverdue: false,
            activeSessions,
            tokenLimited: hasTokenLimited,
            rateLimited: hasRateLimited,
            contextUsagePercent: Math.max(...sessions.map((s: any) => s.percentUsed || 0), 0),
          };
        });

        setAgents(fetchedAgents);
      }
    } catch (error) {
      console.error("Failed to fetch agents:", error);
    } finally {
      setLoading(false);
    }
  }, [connected, request]);

  useEffect(() => {
    if (connected) {
      fetchAgents();
    }
  }, [connected, fetchAgents]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!connected) return;

    const unsubAgent = subscribe("agent", () => {
      fetchAgents();
    });

    const unsubSession = subscribe("session", () => {
      fetchAgents();
    });

    // Periodic refresh
    const interval = setInterval(fetchAgents, 30000);

    return () => {
      unsubAgent();
      unsubSession();
      clearInterval(interval);
    };
  }, [connected, subscribe, fetchAgents]);

  // Merge with default agents to ensure all 6 are shown
  const displayAgents = DEFAULT_AGENTS.map((defaultAgent) => {
    const liveAgent = agents.find((a) => a.id === defaultAgent.id);
    return liveAgent || {
      id: defaultAgent.id,
      name: defaultAgent.name,
      status: "idle" as const,
      model: null,
      lastActivity: null,
      activeSession: null,
      heartbeatNext: null,
      heartbeatOverdue: false,
      activeSessions: 0,
      tokenLimited: false,
      rateLimited: false,
      contextUsagePercent: 0,
    };
  });

  const activeCount = displayAgents.filter((a) => a.status === "active").length;
  const waitingCount = displayAgents.filter((a) => a.status === "waiting").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-100">Agents</h1>
        <span className="text-sm text-zinc-500">
          {activeCount > 0 && `${activeCount} active`}
          {waitingCount > 0 && ` • ${waitingCount} waiting`}
          {activeCount === 0 && waitingCount === 0 && "All idle"}
        </span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48 bg-zinc-800" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayAgents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}
