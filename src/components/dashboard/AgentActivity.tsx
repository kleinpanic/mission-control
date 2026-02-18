"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Activity, MemoryStick, Clock, ChevronDown, ChevronUp, Minimize2, Trash2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAgentName } from "@/lib/agentNames";
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface SessionInfo {
  key: string;
  agentId: string;
  kind: string;
  model: string;
  updatedAt: number;
  age: number;
  percentUsed: number;
  totalTokens: number;
  contextTokens: number;
  remainingTokens: number;
  abortedLastRun?: boolean;
  systemSent?: boolean;
  flags?: string[];
  label?: string;
  inputTokens?: number;
  outputTokens?: number;
}

interface AgentGroup {
  agentId: string;
  sessions: SessionInfo[];
  totalSessions: number;
  activeSessions: number;
  maxContext: number;
  avgContext: number;
  totalTokens: number;
  newestAge: number;
}

function getModelColor(model: string | null | undefined): string {
  if (!model) return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
  const m = model.toLowerCase();
  if (m.includes("claude") || m.includes("sonnet") || m.includes("opus") || m.includes("haiku") || m.includes("anthropic"))
    return "bg-red-500/20 text-red-400 border-red-500/30";
  if (m.includes("gemini") || m.includes("google"))
    return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  if (m.includes("gpt") || m.includes("openai") || m.includes("codex") || m.includes("o1") || m.includes("o3"))
    return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (m.includes("grok") || m.includes("xai"))
    return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
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

function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return String(n);
}

/** Parse a session key into something human-readable */
function parseSessionLabel(key: string, agentId: string): { label: string; kind: string; tooltip: string } {
  // agent:dev:main → main session
  // agent:main:channel:slack:C0AE8SG18KS → slack channel session
  // agent:main:isolated:morning-briefing → isolated cron session
  const stripped = key.replace(`agent:${agentId}:`, "");
  const parts = stripped.split(":");

  if (parts[0] === "channel") {
    return { label: `#${parts[2] || parts[1]}`, kind: "channel", tooltip: `Channel session via ${parts[1]}. Key: ${key}` };
  }
  if (parts[0] === "isolated") {
    return { label: parts.slice(1).join(":") || "isolated", kind: "isolated", tooltip: `Isolated session (sub-agent or cron job). Key: ${key}` };
  }
  if (stripped === "main" || stripped === "") {
    return { label: "main", kind: "main", tooltip: `Primary agent session. Key: ${key}` };
  }
  return { label: stripped.slice(0, 30), kind: "other", tooltip: `Session key: ${key}` };
}

interface AgentActivityProps {
  sessions: any[];
  byAgent?: any[];
}

export function AgentActivity({ sessions = [], byAgent = [] }: AgentActivityProps) {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [fetchedByAgent, setFetchedByAgent] = useState<any[]>([]);
  const [compacting, setCompacting] = useState<Set<string>>(new Set());

  // Self-fetch session data if props are empty (slow tier timing issue)
  useEffect(() => {
    if (byAgent.length > 0) {
      setFetchedByAgent(byAgent);
      return;
    }
    const timer = setTimeout(() => {
      fetch("/api/status")
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.sessions?.byAgent && Array.isArray(data.sessions.byAgent)) {
            setFetchedByAgent(data.sessions.byAgent);
          }
        })
        .catch(() => {});
    }, 2000);
    return () => clearTimeout(timer);
  }, [byAgent]);

  const effectiveByAgent = fetchedByAgent.length > 0 ? fetchedByAgent : byAgent;
  const groups: AgentGroup[] = [];
  const agentMap = new Map<string, SessionInfo[]>();

  // Filter out "system" agent — these are internal OpenClaw infrastructure sessions, not user-facing
  const HIDDEN_AGENTS = new Set(["system"]);

  for (const ba of effectiveByAgent) {
    if (ba.agentId && ba.recent?.length > 0 && !HIDDEN_AGENTS.has(ba.agentId)) {
      agentMap.set(ba.agentId, ba.recent);
    }
  }

  if (agentMap.size === 0) {
    for (const s of sessions) {
      if (!s.agentId || HIDDEN_AGENTS.has(s.agentId)) continue;
      if (!agentMap.has(s.agentId)) agentMap.set(s.agentId, []);
      agentMap.get(s.agentId)!.push(s);
    }
  }

  for (const [agentId, agentSessions] of agentMap) {
    const sorted = agentSessions.sort((a, b) => (a.age ?? Infinity) - (b.age ?? Infinity));
    const activeSessions = sorted.filter(s => s.age != null && s.age < 120000).length;
    const byAgentEntry = byAgent.find((ba: any) => ba.agentId === agentId);
    const totalSessions = byAgentEntry?.count || agentSessions.length;

    groups.push({
      agentId,
      sessions: sorted,
      totalSessions,
      activeSessions,
      maxContext: Math.max(...sorted.map(s => s.percentUsed || 0), 0),
      avgContext: sorted.length > 0
        ? Math.round(sorted.reduce((sum, s) => sum + (s.percentUsed || 0), 0) / sorted.length)
        : 0,
      totalTokens: sorted.reduce((sum, s) => sum + (s.totalTokens || 0), 0),
      newestAge: sorted[0]?.age ?? Infinity,
    });
  }

  groups.sort((a, b) => {
    if (a.activeSessions > 0 && b.activeSessions === 0) return -1;
    if (a.activeSessions === 0 && b.activeSessions > 0) return 1;
    return a.newestAge - b.newestAge;
  });

  const totalActiveSessions = groups.reduce((s, g) => s + g.activeSessions, 0);
  const totalAllSessions = groups.reduce((s, g) => s + g.totalSessions, 0);
  const highContextAgents = groups.filter(g => g.maxContext > 70).length;

  const handleCompactSession = async (sessionKey: string) => {
    setCompacting(prev => new Set(prev).add(sessionKey));
    try {
      const resp = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "compact", key: sessionKey }),
      });
      if (resp.ok) {
        toast.success(`Compacted session`);
      } else {
        toast.error("Failed to compact session");
      }
    } catch {
      toast.error("Failed to compact session");
    } finally {
      setCompacting(prev => { const next = new Set(prev); next.delete(sessionKey); return next; });
    }
  };

  const handleDeleteSession = async (sessionKey: string) => {
    if (!confirm(`Delete session ${sessionKey}? This cannot be undone.`)) return;
    try {
      const resp = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", key: sessionKey }),
      });
      if (resp.ok) {
        toast.success(`Deleted session`);
      } else {
        toast.error("Failed to delete session");
      }
    } catch {
      toast.error("Failed to delete session");
    }
  };

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" />
                Session Activity
              </CardTitle>
              <InfoTip content="Live session breakdown per agent. Shows context window usage, token consumption, and session age. Click an agent to expand and see individual sessions with management actions (compact/delete)." />
            </div>
            <CardDescription className="text-zinc-400">
              {totalAllSessions} sessions across {groups.length} agents
            </CardDescription>
          </div>
          <div className="flex gap-4 text-right">
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <p className="text-[10px] uppercase text-zinc-500">Active</p>
                  <p className={cn("text-lg font-mono font-bold", totalActiveSessions > 0 ? "text-emerald-400" : "text-zinc-500")}>
                    {totalActiveSessions}
                  </p>
                </div>
              </TooltipTrigger>
              <TooltipContent>Sessions with activity in the last 2 minutes</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <p className="text-[10px] uppercase text-zinc-500">High Context</p>
                  <p className={cn("text-lg font-mono font-bold", highContextAgents > 0 ? "text-amber-400" : "text-zinc-500")}>
                    {highContextAgents}
                  </p>
                </div>
              </TooltipTrigger>
              <TooltipContent>Agents with at least one session over 70% context window usage. Consider compacting these sessions.</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {groups.map(group => {
          const isExpanded = expandedAgent === group.agentId;
          return (
            <div key={group.agentId} className="border border-zinc-800 rounded-lg overflow-hidden">
              {/* Agent header */}
              <div
                className={cn(
                  "flex items-center gap-3 p-3 cursor-pointer hover:bg-zinc-800/50 transition-colors",
                  group.activeSessions > 0 && "bg-emerald-500/5"
                )}
                onClick={() => setExpandedAgent(isExpanded ? null : group.agentId)}
              >
                <div className={cn(
                  "w-2.5 h-2.5 rounded-full shrink-0",
                  group.activeSessions > 0 ? "bg-emerald-400 animate-pulse" : group.newestAge < 600000 ? "bg-amber-400" : "bg-zinc-600"
                )} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-100 text-sm">{getAgentName(group.agentId)}</span>
                    <span className="text-xs text-zinc-500 font-mono">{group.agentId}</span>
                    {group.activeSessions > 0 && (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px]">
                        {group.activeSessions} active
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Context usage bar */}
                <div className="flex items-center gap-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="w-24 flex flex-col items-end gap-0.5">
                        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all",
                              group.maxContext > 80 ? "bg-red-500" : group.maxContext > 50 ? "bg-amber-500" : "bg-emerald-500"
                            )}
                            style={{ width: `${Math.min(group.maxContext, 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-zinc-500">{group.maxContext}% peak</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      Peak context window usage across this agent&apos;s sessions. Avg: {group.avgContext}%. Total tokens: {formatTokens(group.totalTokens)}.
                    </TooltipContent>
                  </Tooltip>
                  <div className="text-right w-14">
                    <p className="text-xs text-zinc-400 font-mono">{group.totalSessions}s</p>
                    <p className="text-[10px] text-zinc-500">{formatAge(group.newestAge)}</p>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                </div>
              </div>

              {/* Expanded: individual sessions */}
              {isExpanded && (
                <div className="border-t border-zinc-800 bg-zinc-900/50">
                  <div className="divide-y divide-zinc-800/50">
                    {group.sessions.slice(0, 10).map(session => {
                      const parsed = parseSessionLabel(session.key, group.agentId);
                      const isCompacting = compacting.has(session.key);
                      return (
                        <div key={session.key} className="flex items-center gap-3 px-4 py-2.5 text-xs group/row hover:bg-zinc-800/30">
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full shrink-0",
                            session.age != null && session.age < 120000 ? "bg-emerald-400" : "bg-zinc-700"
                          )} />

                          {/* Session label with tooltip */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <Badge variant="outline" className={cn("text-[9px]",
                                    parsed.kind === "main" ? "border-purple-500/40 text-purple-400"
                                    : parsed.kind === "channel" ? "border-blue-500/40 text-blue-400"
                                    : parsed.kind === "isolated" ? "border-amber-500/40 text-amber-400"
                                    : "border-zinc-600 text-zinc-400"
                                  )}>
                                    {parsed.kind}
                                  </Badge>
                                  <span className="text-zinc-300 truncate font-mono text-[11px]">{parsed.label}</span>
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-sm">
                              <p>{parsed.tooltip}</p>
                              {session.inputTokens != null && <p className="mt-1">Input: {formatTokens(session.inputTokens)} • Output: {formatTokens(session.outputTokens || 0)}</p>}
                            </TooltipContent>
                          </Tooltip>

                          <Badge className={cn("text-[9px]", getModelColor(session.model))}>
                            {shortModel(session.model)}
                          </Badge>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1 text-zinc-500">
                                <MemoryStick className="w-3 h-3" />
                                <span>{session.percentUsed || 0}%</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>Context window: {session.percentUsed || 0}% used. {formatTokens(session.totalTokens || 0)} of {formatTokens(session.contextTokens || 200000)} tokens.</TooltipContent>
                          </Tooltip>

                          <span className="text-zinc-500 w-16 text-right">{formatTokens(session.totalTokens || 0)} tok</span>
                          <span className="text-zinc-500 w-14 text-right">{session.age != null ? formatAge(session.age) : "—"}</span>

                          {/* Session management buttons — visible on hover */}
                          <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost" size="sm"
                                  className="h-6 w-6 p-0 text-zinc-500 hover:text-zinc-200"
                                  disabled={isCompacting}
                                  onClick={(e) => { e.stopPropagation(); handleCompactSession(session.key); }}
                                >
                                  <Minimize2 className="w-3 h-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Compact this session (reduce context by summarizing history)</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost" size="sm"
                                  className="h-6 w-6 p-0 text-zinc-500 hover:text-red-400"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.key); }}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete this session (irreversible)</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost" size="sm"
                                  className="h-6 w-6 p-0 text-zinc-500 hover:text-zinc-200"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(`/sessions?key=${encodeURIComponent(session.key)}`, '_blank');
                                  }}
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View session details</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      );
                    })}
                    {group.sessions.length > 10 && (
                      <div className="px-4 py-2 text-[11px] text-zinc-500">
                        +{group.sessions.length - 10} more sessions
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {groups.length === 0 && (
          <div className="py-6 text-center text-zinc-500 text-sm">No session data available</div>
        )}
      </CardContent>
    </Card>
  );
}
