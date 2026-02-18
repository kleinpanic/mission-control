"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import {
  Users,
  MessageSquare,
  DollarSign,
  Clock,
  RefreshCw,
  Wifi,
  WifiOff,
  Play,
  SkipForward,
  Settings,
  Activity,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Zap,
  Trash2,
  Minimize2,
  ExternalLink,
} from "lucide-react";
import { useGateway } from "@/providers/GatewayProvider";
import { useRealtimeStore } from "@/stores/realtime";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AgentActivity } from "@/components/dashboard/AgentActivity";
import { TaskmasterWidget } from "@/components/dashboard/TaskmasterWidget";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { getAgentName } from "@/lib/agentNames";

/* ─── Types ─── */
interface AgentInfo {
  id: string; name: string; enabled: boolean;
  status: "active" | "idle" | "waiting" | "error";
  model: string | null; authMode: string;
  heartbeatInterval: string; lastActivity: string | null;
  lastActivityAge: string; activeSessions: number; maxSessionPercent: number;
}

interface StatusData {
  gateway: { status: string; url: string; version?: string };
  agents: AgentInfo[];
  sessions: { total: number; atCapacity: number; byAgent?: any[]; recent?: any[] };
  heartbeat: { defaultAgentId: string; nextHeartbeats: HeartbeatEntry[] };
  channels: string[];
}

interface HeartbeatEntry {
  agentId: string; nextIn: string; nextInMs: number; intervalMs?: number;
}

interface CostData {
  summary: { today: number; week: number; month: number; byProvider: Record<string, number>; byModel: Record<string, number> };
  billingAccount?: string;
}

interface CronJob {
  id: string; name: string; schedule: any; enabled: boolean; lastRun?: string; nextRun?: string;
}

/* ─── Model color helpers ─── */
function getModelColor(model: string | null | undefined): string {
  if (!model) return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
  const m = model.toLowerCase();
  if (m.includes("claude") || m.includes("anthropic")) return "bg-red-500/20 text-red-400 border-red-500/30";
  if (m.includes("gpt") || m.includes("openai") || m.includes("codex") || m.includes("o1") || m.includes("o3") || m.includes("o4")) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (m.includes("gemini") || m.includes("google")) return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  if (m.includes("grok") || m.includes("xai")) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  return "bg-purple-500/20 text-purple-400 border-purple-500/30";
}

function getModelDot(model: string | null | undefined): string {
  if (!model) return "bg-zinc-500";
  const m = model.toLowerCase();
  if (m.includes("claude") || m.includes("anthropic")) return "bg-red-400";
  if (m.includes("gpt") || m.includes("openai") || m.includes("codex")) return "bg-emerald-400";
  if (m.includes("gemini") || m.includes("google")) return "bg-blue-400";
  if (m.includes("grok") || m.includes("xai")) return "bg-yellow-400";
  return "bg-purple-400";
}

function shortModel(model: string | null | undefined): string {
  if (!model) return "default";
  return model.replace(/^(anthropic|openai|google|google-gemini-cli|anthropic-nick|openai-codex)\//,"").replace(/-preview$/,"").slice(0,25);
}

/* ─── Cron time-of-day helper ─── */
function getCronHour(job: CronJob): number | null {
  if (job.schedule?.expr) {
    const parts = job.schedule.expr.split(/\s+/);
    if (parts.length >= 2) {
      const h = parseInt(parts[1], 10);
      if (!isNaN(h)) return h;
    }
  }
  if (job.nextRun) {
    try {
      const d = new Date(job.nextRun);
      const localStr = d.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/New_York" });
      const h = parseInt(localStr, 10);
      if (!isNaN(h)) return h;
    } catch {}
  }
  return null;
}

function cronTimeIcon(job: CronJob): "sun" | "moon" | null {
  const h = getCronHour(job);
  if (h === null) return null;
  return (h >= 5 && h < 17) ? "sun" : "moon";
}

/* ─── Budget helpers ─── */
const BUDGET = { daily: 5, weekly: 25, monthly: 80 };

function budgetPct(value: number, limit: number) {
  return limit > 0 ? (value / limit) * 100 : 0;
}

function budgetBadge(value: number, limit: number) {
  const pct = budgetPct(value, limit);
  if (pct >= 100) return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[9px]">OVER</Badge>;
  if (pct >= 75) return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[9px]">{Math.round(pct)}%</Badge>;
  return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px]">{Math.round(pct)}%</Badge>;
}

/* ─── Main ─── */
export default function Dashboard() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [costs, setCosts] = useState<CostData | null>(null);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [taskStats, setTaskStats] = useState<{ today: number; week: number; total: number; inProgress: number; ready: number; review: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [rateLimits, setRateLimits] = useState<any>(null);
  const [heartbeatCountdown, setHeartbeatCountdown] = useState<number | null>(null);
  const heartbeatBaseTime = useRef<number>(0);
  const heartbeatBaseMs = useRef<number>(0);
  const [cronPage, setCronPage] = useState(0);
  const [selectedHb, setSelectedHb] = useState<string | null>(null);
  const [skippedHbs, setSkippedHbs] = useState<Set<string>>(new Set());
  const [triggeredHbs, setTriggeredHbs] = useState<Set<string>>(new Set());
  const [selectedCron, setSelectedCron] = useState<string | null>(null);
  const [runningCrons, setRunningCrons] = useState<Set<string>>(new Set());
  const router = useRouter();

  const { connected, connecting, request, subscribe } = useGateway();
  const { events } = useRealtimeStore();

  // Live heartbeat countdown
  useEffect(() => {
    if (!status?.heartbeat?.nextHeartbeats?.[0]) return;
    const hb = status.heartbeat.nextHeartbeats[0];
    heartbeatBaseMs.current = hb.nextInMs;
    heartbeatBaseTime.current = Date.now();
    setHeartbeatCountdown(hb.nextInMs);

    const interval = setInterval(() => {
      const elapsed = Date.now() - heartbeatBaseTime.current;
      const remaining = Math.max(0, heartbeatBaseMs.current - elapsed);
      setHeartbeatCountdown(remaining);
    }, 1000);
    return () => clearInterval(interval);
  }, [status?.heartbeat?.nextHeartbeats]);

  // Progressive fetcher
  const fetchSafe = useCallback((url: string, timeoutMs = 8000) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { signal: controller.signal })
      .then(r => { clearTimeout(timeout); return r.ok ? r.json() : null; })
      .catch(() => { clearTimeout(timeout); return null; });
  }, []);

  const processAgentsAndStatus = useCallback((agentsResult: any, statusResult: any, channelsResult: any) => {
    if (!agentsResult && !statusResult) return;
    const agents: AgentInfo[] = (agentsResult?.agents || []).map((agent: any) => ({
      id: agent.id,
      name: agent.name || getAgentName(agent.id),
      enabled: agent.enabled !== false,
      status: agent.status || "idle",
      model: agent.model || null,
      authMode: agent.authMode || "unknown",
      heartbeatInterval: agent.heartbeatInterval || "—",
      lastActivity: agent.lastActivity || null,
      lastActivityAge: formatAge(agent.lastActivity),
      activeSessions: agent.sessions || 0,
      maxSessionPercent: agent.contextUsage || 0,
    }));

    setStatus({
      gateway: { status: "connected", url: "ws://127.0.0.1:18789" },
      agents,
      sessions: {
        total: statusResult?.sessions?.total || statusResult?.sessions?.count || 0,
        atCapacity: statusResult?.sessions?.atCapacity || 0,
        byAgent: statusResult?.sessions?.byAgent || [],
        recent: statusResult?.sessions?.recent || [],
      },
      heartbeat: {
        defaultAgentId: statusResult?.heartbeat?.defaultAgentId || "main",
        nextHeartbeats: statusResult?.heartbeat?.nextHeartbeats || [],
      },
      channels: channelsResult?.channels?.map((c: any) => c.id) || [],
    });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const fastPromises = [
        fetchSafe("/api/agents").then(r => {
          if (r?.agents) {
            const agents: AgentInfo[] = r.agents.map((agent: any) => ({
              id: agent.id, name: agent.name || getAgentName(agent.id),
              enabled: agent.enabled !== false, status: agent.status || "idle",
              model: agent.model || null, authMode: agent.authMode || "unknown",
              heartbeatInterval: agent.heartbeatInterval || "—",
              lastActivity: agent.lastActivity || null, lastActivityAge: formatAge(agent.lastActivity),
              activeSessions: agent.sessions || 0, maxSessionPercent: agent.contextUsage || 0,
            }));
            setStatus(prev => prev
              ? { ...prev, agents }
              : { gateway: { status: "connected", url: "ws://127.0.0.1:18789" }, agents, sessions: { total: 0, atCapacity: 0, byAgent: [], recent: [] }, heartbeat: { defaultAgentId: "main", nextHeartbeats: [] }, channels: [] }
            );
          }
          return r;
        }),
        fetchSafe("/api/cron").then(r => { if (r) setCronJobs(r.jobs || r || []); return r; }),
        fetchSafe("/api/tasks?list=agents,shared").then(r => {
          if (r?.tasks) {
            const now = Date.now();
            const oneDayAgo = now - 86400000;
            const oneWeekAgo = now - 7 * 86400000;
            const tasks = r.tasks;
            const completedOrReview = tasks.filter((t: any) =>
              (t.status === "review" || t.status === "completed") && t.statusChangedAt
            );
            setTaskStats({
              today: completedOrReview.filter((t: any) => new Date(t.statusChangedAt).getTime() > oneDayAgo).length,
              week: completedOrReview.filter((t: any) => new Date(t.statusChangedAt).getTime() > oneWeekAgo).length,
              total: completedOrReview.length,
              inProgress: tasks.filter((t: any) => t.status === "in_progress").length,
              ready: tasks.filter((t: any) => t.status === "ready").length,
              review: tasks.filter((t: any) => t.status === "review").length,
            });
          }
          return r;
        }),
        fetchSafe("/api/rate-limits").then(r => { if (r) setRateLimits(r); return r; }),
        fetchSafe("/api/channels"),
      ];

      const slowPromises = [
        fetchSafe("/api/status", 12000),
        fetchSafe("/api/costs", 15000),
      ];

      const [agentsResult, _cron, _tasks, _rates, channelsResult] = await Promise.all(fastPromises);
      setLoading(false);

      const [statusResult, costsResult] = await Promise.all(slowPromises);
      processAgentsAndStatus(agentsResult, statusResult, channelsResult);

      if (costsResult) {
        setCosts({
          summary: {
            today: costsResult.today ?? costsResult.summary?.today ?? 0,
            week: costsResult.week ?? costsResult.summary?.week ?? 0,
            month: costsResult.month ?? costsResult.summary?.month ?? 0,
            byProvider: costsResult.byProvider ?? costsResult.summary?.byProvider ?? {},
            byModel: costsResult.byModel ?? costsResult.summary?.byModel ?? {},
          },
          billingAccount: costsResult.billingAccount,
        });
      }
    } catch (error) {
      console.error("Dashboard fetch error:", error);
    } finally {
      setLoading(false);
    }
  }, [fetchSafe, processAgentsAndStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Real-time subscriptions
  useEffect(() => {
    if (!connected) return;
    const unsubAgent = subscribe("agent", (payload: any) => {
      if (payload.agentId && payload.status) {
        setStatus(prev => prev ? {
          ...prev,
          agents: prev.agents.map(a => a.id === payload.agentId ? { ...a, status: payload.status, lastActivityAge: "Just now" } : a),
        } : prev);
      }
    });
    const unsubHeartbeat = subscribe("heartbeat", () => { setTimeout(fetchData, 1000); });
    const unsubCron = subscribe("cron", () => {
      fetch("/api/cron").then(r => r.ok ? r.json() : null).then(r => { if (r?.jobs) setCronJobs(r.jobs); }).catch(() => {});
    });
    const interval = setInterval(fetchData, connected ? 120000 : 30000);
    const agentPoll = setInterval(() => {
      fetchSafe("/api/agents").then(r => {
        if (!r?.agents) return;
        const agents: AgentInfo[] = r.agents.map((agent: any) => ({
          id: agent.id, name: agent.name || getAgentName(agent.id),
          enabled: agent.enabled !== false, status: agent.status || "idle",
          model: agent.model || null, authMode: agent.authMode || "unknown",
          heartbeatInterval: agent.heartbeatInterval || "—",
          lastActivity: agent.lastActivity || null, lastActivityAge: formatAge(agent.lastActivity),
          activeSessions: agent.sessions || 0, maxSessionPercent: agent.contextUsage || 0,
        }));
        setStatus(prev => prev ? { ...prev, agents } : prev);
      });
    }, 15000);
    return () => { unsubAgent(); unsubHeartbeat(); unsubCron(); clearInterval(interval); clearInterval(agentPoll); };
  }, [connected, subscribe, fetchData, fetchSafe]);

  const handleTriggerHeartbeat = async (agentId?: string) => {
    const target = agentId || selectedHb;
    if (!target) { toast.error("Select a heartbeat first"); return; }
    setTriggering(true);
    try {
      const resp = await fetch("/api/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trigger", agentId: target }),
      });
      if (resp.ok) {
        setTriggeredHbs(prev => new Set(prev).add(target));
        toast.success(`Heartbeat triggered for ${target}!`);
        setTimeout(() => {
          setTriggeredHbs(prev => { const next = new Set(prev); next.delete(target); return next; });
          fetchData();
        }, 30000);
      } else {
        await request("wake", { reason: "manual" });
        toast.success("Heartbeat triggered (global wake)");
      }
      setSelectedHb(null);
    } catch { toast.error("Failed to trigger heartbeat"); }
    finally { setTriggering(false); }
  };

  const handleSkipHeartbeat = (agentId?: string) => {
    const target = agentId || selectedHb;
    if (!target) { toast.error("Select a heartbeat first"); return; }
    setSkippedHbs(prev => new Set(prev).add(target));
    setSelectedHb(null);
    toast.success(`Skipped next heartbeat for ${target}`);
    fetch("/api/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "skip", agentId: target }),
    }).catch(() => {});
    const hb = status?.heartbeat.nextHeartbeats.find(h => h.agentId === target);
    const timeout = hb?.intervalMs || hb?.nextInMs || 300000;
    setTimeout(() => {
      setSkippedHbs(prev => { const next = new Set(prev); next.delete(target); return next; });
      fetchData();
    }, Math.min(timeout, 600000));
  };

  const handleHbDoubleClick = (agentId: string) => { router.push(`/heartbeat?agentId=${agentId}`); };
  const handleCronDoubleClick = (jobId: string) => { router.push(`/cron?highlight=${jobId}`); };

  const handleCronRun = async (jobId?: string) => {
    const target = jobId || selectedCron;
    if (!target) { toast.error("Select a cron job first"); return; }
    setRunningCrons(prev => new Set(prev).add(target));
    try {
      const resp = await fetch("/api/cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run", jobId: target }),
      });
      if (resp.ok) toast.success(`Cron job "${target}" triggered!`);
      else toast.error("Failed to trigger cron job");
    } catch { toast.error("Failed to trigger cron job"); }
    finally {
      setSelectedCron(null);
      setTimeout(() => {
        setRunningCrons(prev => { const next = new Set(prev); next.delete(target); return next; });
        fetchData();
      }, 15000);
    }
  };

  /* ─── Derived data ─── */
  const activeAgents = status?.agents.filter(a => a.status === "active").length || 0;
  const waitingAgents = status?.agents.filter(a => a.status === "waiting").length || 0;
  const idleAgents = status?.agents.filter(a => a.status === "idle").length || 0;
  const capacityAgents = status?.sessions.atCapacity || 0;
  const totalAgents = status?.agents.length || 0;
  const nextHb = status?.heartbeat.nextHeartbeats[0];
  const nextHbAgent = nextHb?.agentId;
  const nextHbModel = status?.agents.find(a => a.id === nextHbAgent)?.model;
  const connectionStatus = connected ? "connected" : connecting ? "connecting" : "disconnected";

  const byAgentArr = Array.isArray(status?.sessions.byAgent) ? status.sessions.byAgent : [];
  const topSessionAgents = byAgentArr
    .map((ba: any) => [ba.agentId, ba.count] as [string, number])
    .sort(([,a],[,b]) => b - a)
    .slice(0, 4);

  const enabledCrons = cronJobs.filter(j => j.enabled);
  const cronPageSize = 5;
  const cronPages = Math.ceil(enabledCrons.length / cronPageSize);
  const visibleCrons = enabledCrons.slice(cronPage * cronPageSize, (cronPage + 1) * cronPageSize);

  const countdownStr = heartbeatCountdown !== null
    ? heartbeatCountdown < 60000 ? `${Math.ceil(heartbeatCountdown / 1000)}s`
    : heartbeatCountdown < 3600000 ? `${Math.ceil(heartbeatCountdown / 60000)}m`
    : `${Math.round(heartbeatCountdown / 3600000 * 10) / 10}h`
    : "—";

  // Cost providers for tooltip
  const costProviders = Object.entries(costs?.summary.byProvider || {})
    .sort(([,a],[,b]) => b - a)
    .map(([k, v]) => `${k}: $${v.toFixed(2)}`).join(", ");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">Dashboard</h1>
          <p className="text-zinc-400">Real-time overview of your OpenClaw system</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
            connectionStatus === "connected" ? "bg-emerald-500/20 text-emerald-400"
            : connectionStatus === "connecting" ? "bg-yellow-500/20 text-yellow-400"
            : "bg-red-500/20 text-red-400"
          )}>
            {connectionStatus === "connected" ? <Wifi className="w-4 h-4" />
            : connectionStatus === "connecting" ? <Loader2 className="w-4 h-4 animate-spin" />
            : <WifiOff className="w-4 h-4" />}
            {connectionStatus === "connected" ? "Live" : connectionStatus === "connecting" ? "Connecting..." : "Disconnected"}
          </div>
          <Button variant="secondary" size="sm" onClick={fetchData} disabled={loading} className="bg-zinc-800 hover:bg-zinc-700">
            <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ─── Overview Cards ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Agents Card */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-sm font-medium text-zinc-300">Agents</CardTitle>
              <InfoTip content="Configured OpenClaw agents. Active = processing now. Pending = waiting on rate limit or response. Idle = no current work. Capacity = max concurrent sessions reached." />
            </div>
            <Users className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-100 mb-1">{totalAgents} configured</div>
            <div className="flex flex-wrap gap-1 mb-1">
              <Badge className={cn("text-[10px]", activeAgents > 0 ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-zinc-800/50 text-zinc-600 border-zinc-700")}>🟢 {activeAgents} active</Badge>
              <Badge className={cn("text-[10px]", waitingAgents > 0 ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" : "bg-zinc-800/50 text-zinc-600 border-zinc-700")}>🟡 {waitingAgents} pending</Badge>
              <Badge className={cn("text-[10px]", idleAgents > 0 ? "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" : "bg-zinc-800/50 text-zinc-600 border-zinc-700")}>⚪ {idleAgents} idle</Badge>
              <Badge className={cn("text-[10px]", capacityAgents > 0 ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-zinc-800/50 text-zinc-600 border-zinc-700")}>🔴 {capacityAgents} capacity</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Total Sessions */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-sm font-medium text-zinc-300">Total Sessions</CardTitle>
              <InfoTip content="Active conversation sessions across all agents. Each session is an ongoing agent context with message history, token usage, and context window consumption." />
            </div>
            <MessageSquare className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-100 mb-1">{status?.sessions.total || 0}</div>
            <div className="space-y-0.5">
              {topSessionAgents.map(([agent, count]) => (
                <div key={agent} className="flex justify-between text-[10px]">
                  <span className="text-zinc-500">{agent}</span>
                  <span className="text-zinc-400 font-mono">{count as number}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tasks */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-sm font-medium text-zinc-300">Tasks</CardTitle>
              <InfoTip content="Tasks from oc-tasks (agents + shared lists). 'Done today' = tasks moved to review or completed in the last 24h. Managed via the Kanban board." />
            </div>
            <CheckCircle2 className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-100 mb-1">{taskStats?.today || 0} <span className="text-sm font-normal text-zinc-500">done today</span></div>
            <div className="flex flex-wrap gap-1">
              {(taskStats?.inProgress || 0) > 0 && <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">{taskStats!.inProgress} in progress</Badge>}
              {(taskStats?.review || 0) > 0 && <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px]">{taskStats!.review} in review</Badge>}
              {(taskStats?.ready || 0) > 0 && <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30 text-[10px]">{taskStats!.ready} ready</Badge>}
            </div>
            <p className="text-xs text-zinc-500 mt-1">Week: {taskStats?.week || 0} • Total: {taskStats?.total || 0}</p>
          </CardContent>
        </Card>

        {/* Today's Cost — FIXED OVERLAP */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-sm font-medium text-zinc-300">Cost</CardTitle>
              <InfoTip content={`Budget: $${BUDGET.daily}/day, $${BUDGET.weekly}/week, $${BUDGET.monthly}/month. Tracks Claude, Codex/OpenAI, and Gemini ($20/mo subscription). ${costProviders || "Loading..."}`} />
            </div>
            <DollarSign className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent className="space-y-1.5">
            {/* Today — standalone line */}
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-zinc-100">${(costs?.summary.today || 0).toFixed(2)}</span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-zinc-500">today</span>
                {budgetBadge(costs?.summary.today || 0, BUDGET.daily)}
              </div>
            </div>
            {/* Weekly */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">${(costs?.summary.week || 0).toFixed(2)}</span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-zinc-500">week</span>
                {budgetBadge(costs?.summary.week || 0, BUDGET.weekly)}
              </div>
            </div>
            {/* Monthly */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">${(costs?.summary.month || 0).toFixed(2)}</span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-zinc-500">month</span>
                {budgetBadge(costs?.summary.month || 0, BUDGET.monthly)}
              </div>
            </div>
            {/* Budget bar */}
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all",
                  budgetPct(costs?.summary.month || 0, BUDGET.monthly) >= 100 ? "bg-red-500"
                  : budgetPct(costs?.summary.month || 0, BUDGET.monthly) >= 75 ? "bg-amber-500"
                  : "bg-emerald-500"
                )}
                style={{ width: `${Math.min(budgetPct(costs?.summary.month || 0, BUDGET.monthly), 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Next Heartbeat */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-sm font-medium text-zinc-300">Next Heartbeat</CardTitle>
              <InfoTip content="Live countdown to the next agent heartbeat check. Heartbeats are periodic health checks where agents review their workspace and report status." />
            </div>
            <Clock className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-100 mb-1 tabular-nums">{countdownStr}</div>
            {nextHbAgent && (
              <div className="flex items-center gap-1.5">
                <span className={cn("w-2 h-2 rounded-full", getModelDot(nextHbModel))} />
                <span className="text-xs text-zinc-400">{nextHbAgent}</span>
                <Badge className={cn("text-[9px]", getModelColor(nextHbModel))}>
                  {shortModel(nextHbModel)}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Taskmaster (full width) ─── */}
      <TaskmasterWidget />

      {/* ─── Rate Limits ─── */}
      {rateLimits && (
        <Card className={cn(
          "bg-zinc-900 border-zinc-800",
          rateLimits.summary?.rateLimited > 0 ? "border-l-4 border-l-amber-500" : "border-l-4 border-l-emerald-500"
        )}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
                {rateLimits.summary?.rateLimited > 0 ? (
                  <><AlertCircle className="w-5 h-5 text-amber-400" /> Rate Limits Active
                    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">{rateLimits.summary.rateLimited}</Badge></>
                ) : (
                  <><CheckCircle2 className="w-5 h-5 text-emerald-400" /> Rate Limits <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">All Clear</Badge></>
                )}
              </CardTitle>
              <InfoTip content="Shows provider-level rate limit cooldowns per agent. When an agent hits a rate limit (e.g., Anthropic 429), it enters a cooldown. 'OK' = no active limits. 'LIMITED' = currently throttled." />
            </div>
            <CardDescription className="text-zinc-400">{rateLimits.summary?.totalAgents || 0} agents monitored</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {(rateLimits.agents || []).map((agent: any) => {
                const agentModel = status?.agents.find(a => a.id === agent.agentId)?.model;
                const activeCooldowns = (agent.cooldowns || []).filter((cd: any) => cd.active);
                const hasActive = activeCooldowns.length > 0;

                return (
                  <div key={agent.agentId} className={cn(
                    "bg-zinc-800/50 rounded-lg p-3 border",
                    hasActive ? "border-amber-500/30" : "border-zinc-700"
                  )}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("w-2 h-2 rounded-full", getModelDot(agentModel))} />
                        <span className="text-sm font-semibold text-zinc-100">{agent.agentName}</span>
                      </div>
                      <Badge className={cn("text-[10px]",
                        hasActive ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      )}>{hasActive ? "LIMITED" : "OK"}</Badge>
                    </div>
                    <Badge className={cn("text-[9px]", getModelColor(agentModel))}>{shortModel(agentModel)}</Badge>
                    {hasActive ? (
                      <div className="space-y-1 mt-2">
                        {activeCooldowns.map((cd: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="text-zinc-400 font-mono text-[11px]">{cd.provider}</span>
                            <span className="text-amber-400 text-[11px]">{cd.remainingHuman}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500 mt-1">No active limits</p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Agents Grid ─── */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg text-zinc-100">Agents</CardTitle>
            <InfoTip content="All configured OpenClaw agents. Click an agent card to see details. Model colors: Red = Claude/Anthropic, Green = OpenAI/Codex, Blue = Gemini/Google, Yellow = Grok/xAI." />
          </div>
          <CardDescription className="text-zinc-400">All configured agents and their current status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {status?.agents.map(agent => (
              <div key={agent.id} className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700 hover:border-zinc-600 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-zinc-100">{agent.name}</h3>
                    <p className="text-xs text-zinc-500">{agent.id}</p>
                  </div>
                  <Badge className={cn("text-[10px]",
                    agent.status === "active" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50"
                    : agent.status === "waiting" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/50"
                    : agent.status === "error" ? "bg-red-500/20 text-red-400 border-red-500/50"
                    : "bg-zinc-500/20 text-zinc-400 border-zinc-500/50"
                  )}>{agent.status.toUpperCase()}</Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Model:</span>
                    <div className="flex items-center gap-1.5">
                      <span className={cn("w-2 h-2 rounded-full", getModelDot(agent.model))} />
                      <span className="text-zinc-200 font-mono text-xs truncate max-w-[130px]">{shortModel(agent.model)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Last Activity:</span>
                    <span className="text-zinc-200">{agent.lastActivityAge || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Heartbeat:</span>
                    <span className={cn("text-zinc-200", agent.heartbeatInterval === "disabled" && "text-zinc-500 italic")}>
                      {agent.heartbeatInterval === "disabled" ? "Disabled" : agent.heartbeatInterval}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Sessions:</span>
                    <span className="text-zinc-200">{agent.activeSessions}</span>
                  </div>
                </div>
              </div>
            )) || <p className="text-zinc-500 col-span-3 text-center py-8">Loading agents...</p>}
          </div>
        </CardContent>
      </Card>

      {/* ─── Heartbeat Control + Cron Jobs ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Heartbeat Control */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
                <Activity className="w-5 h-5" /> Heartbeat Control
              </CardTitle>
              <InfoTip content="Periodic health checks where agents review their workspace HEARTBEAT.md file. Click to select, double-click for detailed view. Trigger = force immediate heartbeat. Skip = defer the next scheduled one." />
            </div>
            <CardDescription className="text-zinc-400">
              Click to select • Double-click for details • {selectedHb ? <span className="text-emerald-400">Selected: {selectedHb}</span> : "No selection"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {status?.heartbeat.nextHeartbeats
              .filter(hb => !skippedHbs.has(hb.agentId))
              .slice(0, 6)
              .map((hb) => {
              const agentModel = status?.agents.find(a => a.id === hb.agentId)?.model;
              const isSelected = selectedHb === hb.agentId;
              const isTriggered = triggeredHbs.has(hb.agentId);
              return (
                <div
                  key={hb.agentId}
                  onClick={() => setSelectedHb(isSelected ? null : hb.agentId)}
                  onDoubleClick={() => handleHbDoubleClick(hb.agentId)}
                  className={cn(
                    "flex items-center justify-between rounded px-3 py-2.5 cursor-pointer transition-all select-none",
                    isSelected
                      ? "bg-emerald-500/10 border border-emerald-500/40 ring-1 ring-emerald-500/20"
                      : "bg-zinc-800/50 border border-transparent hover:bg-zinc-800 hover:border-zinc-700",
                    isTriggered && "bg-amber-500/10 border-amber-500/30"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("w-2 h-2 rounded-full", isTriggered ? "bg-amber-400 animate-pulse" : getModelDot(agentModel))} />
                    <Badge variant="outline" className={cn("text-[10px]", isSelected && "border-emerald-500/50")}>{hb.agentId}</Badge>
                    <Badge className={cn("text-[9px]", getModelColor(agentModel))}>{shortModel(agentModel)}</Badge>
                    {isTriggered && <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[9px] animate-pulse"><Zap className="w-2.5 h-2.5 mr-0.5 inline" />ACTIVE</Badge>}
                  </div>
                  <span className="text-sm text-zinc-400 tabular-nums">in {hb.nextIn}</span>
                </div>
              );
            })}
            {Array.from(skippedHbs).map(agentId => (
              <div key={`skipped-${agentId}`} className="flex items-center justify-between bg-zinc-800/30 rounded px-3 py-2 opacity-50">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-zinc-600" />
                  <Badge variant="outline" className="text-[10px]">{agentId}</Badge>
                  <Badge className="bg-zinc-500/20 text-zinc-500 border-zinc-500/30 text-[9px]">SKIPPED</Badge>
                </div>
                <span className="text-sm text-zinc-600 line-through">skipped</span>
              </div>
            ))}
            {(!status?.heartbeat.nextHeartbeats.length) && <p className="text-zinc-500 text-sm">No heartbeats scheduled</p>}
            <div className="flex gap-2 pt-2">
              <Button onClick={() => handleTriggerHeartbeat()} disabled={triggering || !selectedHb}
                className={cn("flex-1", selectedHb ? "bg-emerald-600 hover:bg-emerald-700" : "bg-zinc-700")}>
                {triggering ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                {selectedHb ? `Trigger ${selectedHb}` : "Select to Trigger"}
              </Button>
              <Button variant="outline" className="flex-1" disabled={!selectedHb} onClick={() => handleSkipHeartbeat()}>
                <SkipForward className="w-4 h-4 mr-2" />
                {selectedHb ? `Skip ${selectedHb}` : "Select to Skip"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Cron Jobs */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
                    <Clock className="w-5 h-5" /> Cron Jobs
                  </CardTitle>
                  <InfoTip content="Scheduled recurring tasks. ☀️ = daytime (5am-5pm), 🌙 = nighttime. Click to select, double-click for detailed view with payload info. 'Run' triggers the job immediately." />
                </div>
                <CardDescription className="text-zinc-400">
                  {enabledCrons.length} active • Click to select • Double-click for details
                  {selectedCron && <> • <span className="text-emerald-400">Selected: {cronJobs.find(j => j.id === selectedCron)?.name || selectedCron}</span></>}
                </CardDescription>
              </div>
              {cronPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setCronPage(p => Math.max(0, p - 1))} disabled={cronPage === 0} className="h-7 w-7 p-0">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-zinc-500">{cronPage + 1}/{cronPages}</span>
                  <Button variant="ghost" size="sm" onClick={() => setCronPage(p => Math.min(cronPages - 1, p + 1))} disabled={cronPage >= cronPages - 1} className="h-7 w-7 p-0">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {visibleCrons.map(job => {
                const icon = cronTimeIcon(job);
                const isSelected = selectedCron === job.id;
                const isRunning = runningCrons.has(job.id);
                return (
                  <div
                    key={job.id}
                    onClick={() => setSelectedCron(isSelected ? null : job.id)}
                    onDoubleClick={() => handleCronDoubleClick(job.id)}
                    className={cn(
                      "flex items-center justify-between rounded px-3 py-2.5 cursor-pointer transition-all select-none",
                      isSelected ? "bg-emerald-500/10 border border-emerald-500/40 ring-1 ring-emerald-500/20"
                      : "bg-zinc-800/50 border border-transparent hover:bg-zinc-800 hover:border-zinc-700",
                      isRunning && "bg-amber-500/10 border-amber-500/30"
                    )}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        {icon === "sun" && <Sun className="w-3.5 h-3.5 text-amber-400" />}
                        {icon === "moon" && <Moon className="w-3.5 h-3.5 text-indigo-400" />}
                        <span className="text-sm text-zinc-200">{job.name || job.id}</span>
                        {isRunning && <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[9px] animate-pulse"><Zap className="w-2.5 h-2.5 mr-0.5 inline" />RUNNING</Badge>}
                      </div>
                      {job.nextRun && <p className="text-xs text-zinc-500">Next: {new Date(job.nextRun).toLocaleString()}</p>}
                    </div>
                    <Badge variant="outline" className={cn("text-[10px]", isSelected && "border-emerald-500/50")}>{job.schedule?.kind || "cron"}</Badge>
                  </div>
                );
              })}
              {enabledCrons.length === 0 && <p className="text-zinc-500 text-sm text-center py-4">No active cron jobs</p>}
            </div>
            <div className="flex gap-2 pt-3">
              <Button onClick={() => handleCronRun()} disabled={!selectedCron || runningCrons.has(selectedCron || "")}
                className={cn("flex-1", selectedCron ? "bg-emerald-600 hover:bg-emerald-700" : "bg-zinc-700")}>
                {runningCrons.has(selectedCron || "") ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                {selectedCron ? `Run ${cronJobs.find(j => j.id === selectedCron)?.name || selectedCron}` : "Select to Run"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agent Activity & Swarm */}
      <AgentActivity
        sessions={status?.sessions.recent || []}
        byAgent={Array.isArray(status?.sessions.byAgent) ? status.sessions.byAgent : []}
      />

      {/* Recent Activity */}
      <ActivityFeed events={events} sessions={Array.isArray(status?.sessions.byAgent) ? status.sessions.byAgent : []} />

      {/* Quick Config */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg text-zinc-100 flex items-center gap-2"><Settings className="w-5 h-5" /> Quick Configuration</CardTitle>
            <InfoTip content="System connection status at a glance. Gateway = WebSocket connection for real-time updates. Channels = configured messaging integrations (Slack, Signal, etc). Providers = active AI model providers." />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
              <h4 className="text-sm font-medium text-zinc-300 mb-2">Gateway</h4>
              <p className="text-lg font-mono text-emerald-400">{connected ? "Connected" : connecting ? "Connecting..." : "Disconnected"}</p>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
              <h4 className="text-sm font-medium text-zinc-300 mb-2">Channels</h4>
              <p className="text-lg font-mono text-zinc-100">{status?.channels.length || 0}</p>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
              <h4 className="text-sm font-medium text-zinc-300 mb-2">Providers</h4>
              <p className="text-lg font-mono text-zinc-100">{Object.keys(costs?.summary.byProvider || {}).join(", ") || "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatAge(timestamp: string | null): string {
  if (!timestamp) return "—";
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}
