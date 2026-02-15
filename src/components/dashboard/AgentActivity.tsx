"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, 
  Cpu, 
  Layers, 
  ArrowRight, 
  Activity,
  CircleDot
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SubagentSession {
  key: string;
  agentId: string;
  label?: string;
  status: "active" | "idle" | "waiting";
  model: string;
  parentKey?: string;
  children: SubagentSession[];
  updatedAt: number;
}

interface ActivityMetrics {
  swarmWorkers: number;
  activeSubagents: number;
  concurrentToolCalls: number;
  multiToolUse: boolean;
}

interface AgentActivityProps {
  sessions: any[];
}

export function AgentActivity({ sessions = [] }: AgentActivityProps) {
  const [hierarchy, setHierarchy] = useState<SubagentSession[]>([]);
  const [metrics, setMetrics] = useState<ActivityMetrics>({
    swarmWorkers: 0,
    activeSubagents: 0,
    concurrentToolCalls: 0,
    multiToolUse: false
  });

  useEffect(() => {
    if (!sessions || !Array.isArray(sessions)) return;

    // 1. Process sessions into a hierarchy
    const sessionMap = new Map<string, SubagentSession>();
    const roots: SubagentSession[] = [];

    // First pass: Create nodes
    sessions.forEach(s => {
      // Derive a better label from session key if label/displayName isn't set
      let derivedLabel = s.label || s.displayName;
      if (!derivedLabel) {
        const parts = s.key.split(':');
        if (parts.includes('subagent')) {
          // Subagent session: use the ID after 'subagent'
          const idx = parts.indexOf('subagent');
          derivedLabel = `Subagent ${parts[idx + 1]?.slice(0, 8) || 'Worker'}`;
        } else if (parts.length > 3) {
          // Other nested session: use last 2 parts
          derivedLabel = parts.slice(-2).join(' › ');
        } else {
          derivedLabel = parts[parts.length - 1] || 'Session';
        }
      }
      
      const session: SubagentSession = {
        key: s.key,
        agentId: s.agentId,
        label: derivedLabel,
        status: s.percentUsed >= 95 ? "waiting" : (Date.now() - (s.updatedAt || 0) < 60000 ? "active" : "idle"),
        model: s.model || "unknown",
        children: [],
        updatedAt: s.updatedAt || 0
      };

      // Try to determine parent from key: agent:dev:subagent:ID -> parent is agent:dev:main
      if (s.key.includes(':subagent:')) {
        const parts = s.key.split(':');
        if (parts.length >= 3) {
          const agentId = parts[1];
          session.parentKey = `agent:${agentId}:main`;
        }
      } else if (s.key.split(':').length > 3) {
        // Fallback parent for other nested sessions
        const parts = s.key.split(':');
        session.parentKey = parts.slice(0, 3).join(':');
      }

      sessionMap.set(s.key, session);
    });

    // Second pass: Build tree
    sessionMap.forEach(session => {
      if (session.parentKey && sessionMap.has(session.parentKey)) {
        sessionMap.get(session.parentKey)!.children.push(session);
      } else {
        // Roots: either main agents or subagents with no resolved parent in the current list
        // Include everything that isn't already a child
        roots.push(session);
      }
    });

    // Sort roots by status (active first) then updatedAt
    const sortedRoots = roots
      .sort((a, b) => {
        if (a.status === "active" && b.status !== "active") return -1;
        if (a.status !== "active" && b.status === "active") return 1;
        return b.updatedAt - a.updatedAt;
      });

    setHierarchy(sortedRoots);

    // 2. Calculate metrics
    const swarmWorkers = sessions.filter(s => s.model?.toLowerCase().includes('flash')).length;
    const activeSubagents = sessions.filter(s => s.key.includes(':subagent:')).length;
    const concurrentToolCalls = sessions.filter(s => (Date.now() - (s.updatedAt || 0) < 20000)).length;

    setMetrics({
      swarmWorkers,
      activeSubagents,
      concurrentToolCalls,
      multiToolUse: concurrentToolCalls > 1
    });
  }, [sessions]);

  // if (hierarchy.length === 0 && metrics.swarmWorkers === 0) {
  //   return null; // Don't show if no relevant activity
  // }

  return (
    <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
      <CardHeader className="border-b border-zinc-800/50 bg-zinc-900/50">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              Agent Activity & Swarm
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Real-time parallel execution and subagent hierarchy
            </CardDescription>
          </div>
          <div className="flex gap-4">
            <MetricBadge 
              icon={<Cpu className="w-3 h-3" />} 
              label="Swarm" 
              value={metrics.swarmWorkers} 
              color="text-blue-400"
            />
            <MetricBadge 
              icon={<Layers className="w-3 h-3" />} 
              label="Subagents" 
              value={metrics.activeSubagents} 
              color="text-purple-400"
            />
            <MetricBadge 
              icon={<Activity className="w-3 h-3" />} 
              label="Tools" 
              value={metrics.concurrentToolCalls} 
              color="text-emerald-400"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-zinc-800">
          {hierarchy.map(node => (
            <ActivityNode key={node.key} node={node} level={0} />
          ))}
        </div>
        {hierarchy.length === 0 && (
          <div className="py-8 text-center text-zinc-500 text-sm">
            No active subagent hierarchies detected
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricBadge({ icon, label, value, color }: { icon: any, label: string, value: number, color: string }) {
  return (
    <div className="flex flex-col items-end">
      <span className="text-[10px] text-zinc-500 uppercase font-semibold">{label}</span>
      <div className={cn("flex items-center gap-1 font-mono text-sm font-bold", color)}>
        {icon}
        {value}
      </div>
    </div>
  );
}

function ActivityNode({ node, level }: { node: SubagentSession, level: number }) {
  const isParent = node.children.length > 0;
  
  return (
    <div className={cn(
      "group transition-colors hover:bg-zinc-800/30",
      level === 0 ? "bg-zinc-900" : "bg-transparent"
    )}>
      <div className="flex items-center gap-3 p-3" style={{ paddingLeft: `${level * 24 + 12}px` }}>
        {level > 0 && <ArrowRight className="w-3 h-3 text-zinc-600" />}
        
        <div className="relative">
          <CircleDot className={cn(
            "w-4 h-4",
            node.status === "active" ? "text-emerald-500 animate-pulse" : 
            node.status === "waiting" ? "text-amber-500" : "text-zinc-600"
          )} />
          {node.status === "active" && (
            <span className="absolute -inset-1 bg-emerald-500/20 rounded-full animate-ping" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-200 text-sm truncate">
              {node.label || node.agentId}
            </span>
            <Badge variant="outline" className="text-[9px] h-4 py-0 px-1 text-zinc-500 border-zinc-800">
              {node.model.split('/').pop()}
            </Badge>
          </div>
          {level === 0 && isParent && (
            <p className="text-[10px] text-zinc-500">Parent Agent ({node.agentId})</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Badge className={cn(
            "text-[9px] font-bold px-1.5 py-0",
            node.status === "active" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
            node.status === "waiting" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
            "bg-zinc-800 text-zinc-500 border-transparent"
          )}>
            {node.status.toUpperCase()}
          </Badge>
        </div>
      </div>
      
      {node.children.map(child => (
        <ActivityNode key={child.key} node={child} level={level + 1} />
      ))}
    </div>
  );
}
