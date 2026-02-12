"use client";

import { useAgentsStore } from "@/stores/agents";
import { AgentCard } from "@/components/agents/AgentCard";
import { Skeleton } from "@/components/ui/skeleton";

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
  const { agents, loading } = useAgentsStore();

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
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-100">Agents</h1>
        <span className="text-sm text-zinc-500">
          {agents.filter((a) => a.status === "active").length} active
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
