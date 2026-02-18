"use client";

import { useState, useMemo } from "react";
import { Event } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAgentName } from "@/lib/agentNames";
import {
  Play,
  CheckCircle,
  MessageSquare,
  Clock,
  AlertCircle,
  Activity,
  Filter,
  X,
  MemoryStick,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { InfoTip } from "@/components/ui/info-tip";

function getModelColor(model: string | null | undefined): string {
  if (!model) return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
  const m = model.toLowerCase();
  if (m.includes("claude") || m.includes("sonnet") || m.includes("opus") || m.includes("anthropic"))
    return "bg-red-500/20 text-red-400 border-red-500/30";
  if (m.includes("gemini") || m.includes("google"))
    return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  if (m.includes("gpt") || m.includes("openai") || m.includes("codex"))
    return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
}

function shortModel(model: string): string {
  return model
    .replace(/^(anthropic|openai|google|google-gemini-cli|anthropic-nick|openai-codex)\//,"")
    .replace(/-preview$/,"")
    .slice(0, 20);
}

function formatAge(ms: number): string {
  if (ms < 60000) return "Just now";
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
  return `${Math.floor(ms / 86400000)}d ago`;
}

interface ActivityFeedProps {
  events: Event[];
  sessions?: any[];
}

export function ActivityFeed({ events, sessions = [] }: ActivityFeedProps) {
  const [filterAgent, setFilterAgent] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  // Build a combined activity list from WS events + session data
  const activities = useMemo(() => {
    const items: {
      id: string;
      agentId: string;
      agentName: string;
      model: string | null;
      kind: string;
      detail: string;
      ageMs: number;
      ageStr: string;
      contextPct: number;
      tokens: number;
      source: "ws" | "session";
    }[] = [];

    // WS events
    for (const ev of events) {
      items.push({
        id: `ws-${ev.timestamp || Math.random()}`,
        agentId: ev.agentId || "system",
        agentName: ev.agentId ? getAgentName(ev.agentId) : "System",
        model: null,
        kind: ev.type,
        detail: ev.data?.message || ev.data?.text || ev.type,
        ageMs: ev.timestamp ? Date.now() - new Date(ev.timestamp).getTime() : 0,
        ageStr: ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : "",
        contextPct: 0,
        tokens: 0,
        source: "ws",
      });
    }

    // Session data (when no WS events or as supplement)
    if (sessions.length > 0) {
      for (const ba of sessions) {
        for (const s of (ba.recent || []).slice(0, 3)) {
          items.push({
            id: s.key || `sess-${ba.agentId}-${Math.random()}`,
            agentId: s.agentId || ba.agentId,
            agentName: getAgentName(s.agentId || ba.agentId),
            model: s.model || null,
            kind: "session",
            detail: `${s.percentUsed || 0}% context • ${((s.totalTokens || 0) / 1000).toFixed(0)}k tokens`,
            ageMs: s.age ?? Infinity,
            ageStr: s.age != null ? formatAge(s.age) : "—",
            contextPct: s.percentUsed || 0,
            tokens: s.totalTokens || 0,
            source: "session",
          });
        }
      }
    }

    // Sort by age (newest first)
    items.sort((a, b) => a.ageMs - b.ageMs);

    // Filter by agent if set
    if (filterAgent) {
      return items.filter(i => i.agentId === filterAgent);
    }

    return items.slice(0, 20);
  }, [events, sessions, filterAgent]);

  // Unique agents for filter menu
  const agentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const a of activities) ids.add(a.agentId);
    return Array.from(ids).sort();
  }, [activities]);

  const getKindIcon = (kind: string) => {
    switch (kind) {
      case "session": return <Activity className="w-3.5 h-3.5 text-zinc-400" />;
      case "heartbeat": return <Clock className="w-3.5 h-3.5 text-blue-400" />;
      case "agent.start": return <Play className="w-3.5 h-3.5 text-emerald-400" />;
      case "agent.complete": return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
      case "message": return <MessageSquare className="w-3.5 h-3.5 text-purple-400" />;
      case "error": return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
      default: return <Activity className="w-3.5 h-3.5 text-zinc-500" />;
    }
  };

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg text-zinc-100">Recent Activity</CardTitle>
            <InfoTip content="Combined view of real-time WebSocket events and session data. Shows per-agent activity with model badges, context usage, and token consumption. Use the filter dropdown to focus on a specific agent." />
          </div>
          <div className="flex items-center gap-2">
            {filterAgent && (
              <Badge className="bg-zinc-800 text-zinc-300 cursor-pointer" onClick={() => setFilterAgent(null)}>
                {getAgentName(filterAgent)} <X className="w-3 h-3 ml-1" />
              </Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-200">
                  <Filter className="w-4 h-4 mr-1" /> Filter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-zinc-900 border-zinc-700">
                <DropdownMenuLabel className="text-zinc-400">By Agent</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={!filterAgent}
                  onClick={() => setFilterAgent(null)}
                  className="text-zinc-300"
                >
                  All agents
                </DropdownMenuCheckboxItem>
                {agentIds.map(id => (
                  <DropdownMenuCheckboxItem
                    key={id}
                    checked={filterAgent === id}
                    onClick={() => setFilterAgent(id)}
                    className="text-zinc-300"
                  >
                    {getAgentName(id)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="sm" className="text-zinc-400" onClick={() => setExpanded(!expanded)}>
              {expanded ? "Collapse" : "Expand"}
            </Button>
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent>
          {activities.length === 0 ? (
            <div className="py-8 text-center text-zinc-500">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No recent activity</p>
              <p className="text-xs mt-1">Events will appear here in real-time</p>
            </div>
          ) : (
            <div className="space-y-1">
              {activities.map((item) => (
                <div key={item.id} className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800/50 transition-colors",
                  item.ageMs < 120000 && "bg-emerald-500/5"
                )}>
                  {getKindIcon(item.kind)}

                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <Badge className={cn("text-[9px] shrink-0", getModelColor(item.model))}>
                      {item.agentName}
                    </Badge>
                    {item.model && (
                      <span className="text-[10px] text-zinc-500 font-mono">{shortModel(item.model)}</span>
                    )}
                    <span className="text-xs text-zinc-400 truncate">{item.detail}</span>
                  </div>

                  {item.contextPct > 0 && (
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="w-12 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full",
                            item.contextPct > 80 ? "bg-red-500" : item.contextPct > 50 ? "bg-amber-500" : "bg-emerald-500"
                          )}
                          style={{ width: `${Math.min(item.contextPct, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <span className="text-[11px] text-zinc-500 shrink-0 w-16 text-right">{item.ageStr}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
