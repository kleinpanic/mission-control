"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { useGateway } from "@/providers/GatewayProvider";
import { useRealtimeStore } from "@/stores/realtime";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AgentActivity } from "@/components/dashboard/AgentActivity";
import { TaskmasterWidget } from "@/components/dashboard/TaskmasterWidget";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { getAgentName } from "@/lib/agentNames";

interface AgentInfo {
  id: string;
  name: string;
  enabled: boolean;
  status: "active" | "idle" | "waiting" | "error";
  model: string | null;
  authMode: string; // "oauth" | "api" | "token" | "local" | "unknown"
  heartbeatInterval: string;
  lastActivity: string | null;
  lastActivityAge: string;
  activeSessions: number;
  maxSessionPercent: number;
}

interface StatusData {
  gateway: {
    status: "connected" | "disconnected" | "unknown";
    url: string;
    uptime?: number;
    version?: string;
  };
  agents: AgentInfo[];
  sessions: {
    total: number;
    atCapacity: number;
    recent?: any[];
  };
  heartbeat: {
    defaultAgentId: string;
    nextHeartbeats: { agentId: string; nextIn: string; nextInMs: number }[];
  };
  channels: string[];
  health?: {
    status: string;
    checks?: Record<string, any>;
  };
}

interface CostData {
  summary: {
    today: number;
    week: number;
    month: number;
    byProvider: Record<string, number>;
    byModel: Record<string, number>;
  };
  billingAccount?: string;
}

interface CronJob {
  id: string;
  name: string;
  schedule: any;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

export default function Dashboard() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [costs, setCosts] = useState<CostData | null>(null);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [taskStats, setTaskStats] = useState<{ today: number; week: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [rateLimits, setRateLimits] = useState<any>(null);

  const { connected, connecting, request, subscribe } = useGateway();
  const { events } = useRealtimeStore();

  const fetchData = useCallback(async () => {
    if (!connected) return;
    
    setLoading(true);
    try {
      // Fetch all data in parallel
      // Note: Prefer HTTP endpoints to avoid WebSocket pairing issues
      const [agentsResult, statusResult, costsResult, cronResult, channelsResult, tasksResult, rateLimitsResult] = await Promise.all([
        // Always prefer HTTP /api/agents (enriched with runtime data: sessions, lastActivity, heartbeat)
        // WS agents.list only has config data without runtime enrichment
        fetch("/api/agents").then(r => r.json()).catch(e => { console.error("agents API error:", e); return null; }),
        fetch("/api/status").then(r => r.json()).catch(e => { console.error("status API error:", e); return null; }),
        fetch("/api/costs").then(r => r.json()).catch(e => { console.error("costs API error:", e); return null; }),
        (connected ? request<any>("cron.list").catch(() => null) : Promise.resolve(null))
          .then(ws => ws || fetch("/api/cron").then(r => r.json()).catch(e => { console.error("cron API error:", e); return null; })),
        fetch("/api/channels").then(r => r.json()).catch(e => { console.error("channels API error:", e); return null; }),
        fetch("/api/tasks?status=completed,review").then(r => r.json()).catch(e => { console.error("tasks API error:", e); return null; }),
        fetch("/api/rate-limits").then(r => r.json()).catch(e => { console.error("rate-limits API error:", e); return null; }),
      ]);
      
      // Update rate limits state
      if (rateLimitsResult) setRateLimits(rateLimitsResult);
      
      if (agentsResult || statusResult) {
        // Use agents data directly from /api/agents (already enriched with runtime data)
        const agents: AgentInfo[] = (agentsResult?.agents || []).map((agent: any) => {
          return {
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
          };
        });

        setStatus({
          gateway: {
            status: "connected",
            url: typeof window !== "undefined"
              ? (["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)
                ? "ws://127.0.0.1:18789"
                : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}:${window.location.port}/api/gateway/ws`)
              : "ws://127.0.0.1:18789",
            uptime: undefined,
            version: undefined,
          },
          agents,
          sessions: {
            total: statusResult?.sessions?.total || statusResult?.sessions?.count || 0,
            atCapacity: statusResult?.sessions?.recent?.filter((s: any) => s.percentUsed >= 95).length || 0,
            recent: statusResult?.sessions?.recent || [],
          },
          heartbeat: {
            defaultAgentId: statusResult?.heartbeat?.defaultAgentId || agentsResult?.defaultId || "main",
            nextHeartbeats: statusResult?.heartbeat?.next || [],
          },
          channels: channelsResult?.channels?.map((c: any) => c.id) || [],
          health: { status: "ok" },
        });
      }

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

      if (cronResult) {
        setCronJobs(cronResult.jobs || cronResult || []);
      }

      // Calculate task stats
      if (tasksResult?.tasks) {
        const now = Date.now();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);
        const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
        
        // Count tasks that moved to review or completed status (based on statusChangedAt)
        const completedOrReviewTasks = tasksResult.tasks.filter((t: any) => 
          (t.status === 'review' || t.status === 'completed') && t.statusChangedAt
        );
        const tasksToday = completedOrReviewTasks.filter((t: any) => 
          new Date(t.statusChangedAt).getTime() > oneDayAgo
        );
        const tasksWeek = completedOrReviewTasks.filter((t: any) => 
          new Date(t.statusChangedAt).getTime() > oneWeekAgo
        );
        
        setTaskStats({
          today: tasksToday.length,
          week: tasksWeek.length,
          total: completedOrReviewTasks.length,
        });
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      toast.error("Failed to fetch dashboard data");
    } finally {
      setLoading(false);
    }
  }, [connected, request]);

  // Fetch data when connected
  useEffect(() => {
    if (connected) {
      fetchData();
    }
  }, [connected, fetchData]);

  // Subscribe to real-time events
  useEffect(() => {
    if (!connected) return;

    // Subscribe to agent events for live status updates
    const unsubAgent = subscribe("agent", (payload) => {
      console.log("[Dashboard] Agent event:", payload);
      // Update agent status in real-time
      if (payload.agentId && payload.status) {
        setStatus(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            agents: prev.agents.map(a => 
              a.id === payload.agentId 
                ? { ...a, status: payload.status, lastActivityAge: "Just now" }
                : a
            )
          };
        });
      }
    });

    // Subscribe to heartbeat events
    const unsubHeartbeat = subscribe("heartbeat", (payload) => {
      console.log("[Dashboard] Heartbeat event:", payload);
      toast.info(`Heartbeat: ${payload.agentId || "main"}`);
      // Refresh data after heartbeat
      setTimeout(fetchData, 1000);
    });

    // Subscribe to cron events
    const unsubCron = subscribe("cron", (payload) => {
      console.log("[Dashboard] Cron event:", payload);
      // Refresh cron data
      request<any>("cron.list").then(result => {
        if (result) setCronJobs(result.jobs || result || []);
      }).catch(console.error);
    });

    // Subscribe to health events
    const unsubHealth = subscribe("health", (payload) => {
      console.log("[Dashboard] Health event:", payload);
      if (payload.status === "degraded" || payload.status === "unhealthy") {
        toast.warning(`Gateway health: ${payload.status}`);
      }
    });

    // Periodic refresh every 30 seconds for data that doesn't have events
    const interval = setInterval(fetchData, 30000);

    return () => {
      unsubAgent();
      unsubHeartbeat();
      unsubCron();
      unsubHealth();
      clearInterval(interval);
    };
  }, [connected, subscribe, request, fetchData]);

  const handleTriggerHeartbeat = async () => {
    if (!connected) {
      toast.error("Not connected to gateway");
      return;
    }
    
    setTriggering(true);
    try {
      await request("wake", { reason: "manual" });
      toast.success("Heartbeat triggered!");
      setTimeout(fetchData, 2000);
    } catch (error) {
      console.error("Failed to trigger heartbeat:", error);
      toast.error("Failed to trigger heartbeat");
    } finally {
      setTriggering(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/50";
      case "waiting":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50";
      case "error":
        return "bg-red-500/20 text-red-400 border-red-500/50";
      default:
        return "bg-zinc-500/20 text-zinc-400 border-zinc-500/50";
    }
  };

  const activeAgents = status?.agents.filter((a) => a.status === "active").length || 0;
  const waitingAgents = status?.agents.filter((a) => a.status === "waiting").length || 0;
  const totalAgents = status?.agents.length || 0;
  const nextHeartbeat = status?.heartbeat.nextHeartbeats[0];

  // Connection status display
  const connectionStatus = connected ? "connected" : connecting ? "connecting" : "disconnected";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">Dashboard</h1>
          <p className="text-zinc-400">Real-time overview of your OpenClaw system</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Connection Status */}
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
              connectionStatus === "connected"
                ? "bg-emerald-500/20 text-emerald-400"
                : connectionStatus === "connecting"
                ? "bg-yellow-500/20 text-yellow-400"
                : "bg-red-500/20 text-red-400"
            )}
          >
            {connectionStatus === "connected" ? (
              <Wifi className="w-4 h-4" />
            ) : connectionStatus === "connecting" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <WifiOff className="w-4 h-4" />
            )}
            {connectionStatus === "connected"
              ? "Live"
              : connectionStatus === "connecting"
              ? "Connecting..."
              : "Disconnected"}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchData}
            disabled={loading || !connected}
            className="bg-zinc-800 hover:bg-zinc-700"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-300">Agents</CardTitle>
            <Users className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-100">
              {activeAgents > 0 ? (
                <span className="text-emerald-400">{activeAgents} active</span>
              ) : waitingAgents > 0 ? (
                <span className="text-yellow-400">{waitingAgents} waiting</span>
              ) : (
                <span>{totalAgents} idle</span>
              )}
            </div>
            <p className="text-xs text-zinc-500">
              {totalAgents} configured • {status?.sessions.atCapacity || 0} at capacity
            </p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-300">Total Sessions</CardTitle>
            <MessageSquare className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-100">{status?.sessions.total || 0}</div>
            <p className="text-xs text-zinc-500">Active conversations</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-300">Tasks Completed Today</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-100">{taskStats?.today || 0}</div>
            <p className="text-xs text-zinc-500">
              Week: {taskStats?.week || 0} • Total: {taskStats?.total || 0}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-300">Today&apos;s Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-100">
              ${(costs?.summary.today || 0).toFixed(2)}
            </div>
            <p className="text-xs text-zinc-500">
              Week: ${(costs?.summary.week || 0).toFixed(2)} • Month: $
              {(costs?.summary.month || 0).toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-300">Next Heartbeat</CardTitle>
            <Clock className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-100">
              {nextHeartbeat?.nextIn || "~15m"}
            </div>
            <p className="text-xs text-zinc-500">Agent: {getAgentName(nextHeartbeat?.agentId || "main")}</p>
          </CardContent>
        </Card>
      </div>

      {/* System Status Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <TaskmasterWidget />
      </div>

      {/* Rate Limits */}
      {rateLimits && rateLimits.summary?.rateLimited > 0 && (
        <Card className="bg-zinc-900 border-zinc-800 border-l-4 border-l-amber-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              Rate Limits Active
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                {rateLimits.summary.rateLimited} agent{rateLimits.summary.rateLimited > 1 ? 's' : ''}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {rateLimits.agents
                .filter((a: any) => a.hasActiveCooldown)
                .map((agent: any) => (
                  <div key={agent.agentId} className="bg-zinc-800/50 rounded-lg p-3 border border-amber-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-zinc-100">{agent.agentName}</span>
                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">LIMITED</Badge>
                    </div>
                    <div className="space-y-1">
                      {agent.cooldowns
                        .filter((c: any) => c.active)
                        .map((cooldown: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between text-xs gap-2">
                            <div className="flex items-center gap-1">
                              <span className="text-zinc-400 font-mono">{cooldown.provider}</span>
                              {cooldown.authMode && cooldown.authMode !== 'unknown' && (
                                <span className={cn("text-[9px] px-1 rounded",
                                  cooldown.authMode === 'oauth' ? 'bg-emerald-500/20 text-emerald-400' :
                                  cooldown.authMode === 'api' || cooldown.authMode === 'token' ? 'bg-amber-500/20 text-amber-400' :
                                  'bg-zinc-500/20 text-zinc-400'
                                )}>
                                  {cooldown.authMode === 'oauth' ? 'OAuth' : 'API'}
                                </span>
                              )}
                            </div>
                            <span className="text-amber-400">{cooldown.remainingHuman}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agents Grid */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-100">Agents</CardTitle>
          <CardDescription className="text-zinc-400">All configured agents and their current status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {status?.agents.map((agent) => (
              <div
                key={agent.id}
                className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700 hover:border-zinc-600 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-zinc-100">{agent.name}</h3>
                    <p className="text-xs text-zinc-500">{agent.id}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {rateLimits?.agents?.find((a: any) => a.agentId === agent.id)?.hasActiveCooldown && (
                      <Badge className="text-[10px] bg-amber-500/20 text-amber-400 border-amber-500/30">
                        LIMITED
                      </Badge>
                    )}
                    <Badge className={cn("text-[10px]", getStatusColor(agent.status))}>
                      {agent.status.toUpperCase()}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Model:</span>
                    <div className="flex items-center gap-1.5">
                      <Badge className={cn("text-[9px] px-1 py-0",
                        agent.authMode === "oauth" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                        agent.authMode === "api" || agent.authMode === "token" ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
                        agent.authMode === "local" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" :
                        "bg-zinc-500/20 text-zinc-400 border-zinc-500/30"
                      )}>
                        {agent.authMode === "oauth" ? "OAuth" :
                         agent.authMode === "api" ? "API" :
                         agent.authMode === "token" ? "API" :
                         agent.authMode === "local" ? "Local" : "?"}
                      </Badge>
                      <span className="text-zinc-200 font-mono text-xs truncate max-w-[130px]">
                        {agent.model || "default"}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Last Activity:</span>
                    <span className="text-zinc-200">{agent.lastActivityAge || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Heartbeat:</span>
                    <span className="text-zinc-200">{agent.heartbeatInterval}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Sessions:</span>
                    <span className="text-zinc-200">{agent.activeSessions}</span>
                  </div>
                  {agent.maxSessionPercent > 80 && (
                    <div className="mt-2 pt-2 border-t border-zinc-700">
                      <div className="flex items-center gap-2 text-amber-400 text-xs">
                        <AlertCircle className="w-3 h-3" />
                        Session at {agent.maxSessionPercent}% capacity
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )) || (
              <p className="text-zinc-500 col-span-3 text-center py-8">
                {!connected ? "Connecting to gateway..." : "Loading agents..."}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Heartbeat Control */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Heartbeat Control
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Preview and control heartbeat scheduling
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Next Heartbeats */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-zinc-300">Upcoming Heartbeats</h4>
              {status?.heartbeat.nextHeartbeats.slice(0, 5).map((hb, _idx) => (
                <div
                  key={hb.agentId}
                  className="flex items-center justify-between bg-zinc-800/50 rounded px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {hb.agentId}
                    </Badge>
                  </div>
                  <span className="text-sm text-zinc-400">in {hb.nextIn}</span>
                </div>
              )) || <p className="text-zinc-500 text-sm">No heartbeats scheduled</p>}
            </div>

            {/* Control Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleTriggerHeartbeat}
                disabled={triggering || !connected}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {triggering ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Trigger Now
              </Button>
              <Button variant="outline" className="flex-1" disabled>
                <SkipForward className="w-4 h-4 mr-2" />
                Skip Next
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Next Cron Jobs */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Next Cron Jobs
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Upcoming scheduled tasks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {cronJobs
                .filter((job) => job.enabled)
                .slice(0, 5)
                .map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between bg-zinc-800/50 rounded px-3 py-2"
                  >
                    <div className="flex-1">
                      <span className="text-sm text-zinc-200">{job.name || job.id}</span>
                      {job.nextRun && (
                        <p className="text-xs text-zinc-500">
                          Next: {new Date(job.nextRun).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {job.schedule?.kind || "cron"}
                    </Badge>
                  </div>
                ))}
              {cronJobs.filter((job) => job.enabled).length === 0 && (
                <p className="text-zinc-500 text-sm text-center py-4">No active cron jobs</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agent Activity & Swarm */}
      <AgentActivity sessions={status?.sessions.recent || []} />

      {/* Recent Activity */}
      <ActivityFeed events={events} />

      {/* Quick Config */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Quick Configuration
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Common settings and model configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
              <h4 className="text-sm font-medium text-zinc-300 mb-2">Gateway Status</h4>
              <p className="text-lg font-mono text-emerald-400">
                {connected ? "Connected" : connecting ? "Connecting..." : "Disconnected"}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {status?.gateway?.version ? `v${status.gateway.version}` : "WebSocket Protocol v3"}
              </p>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
              <h4 className="text-sm font-medium text-zinc-300 mb-2">Active Channels</h4>
              <p className="text-lg font-mono text-zinc-100">
                {status?.channels.length || 0}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {status?.channels.slice(0, 3).join(", ") || "No channels"}
                {(status?.channels.length || 0) > 3 && "..."}
              </p>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
              <h4 className="text-sm font-medium text-zinc-300 mb-2">Billing Account</h4>
              <p className="text-lg font-mono text-zinc-100">
                {costs?.billingAccount || "Default"}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {Object.keys(costs?.summary.byProvider || {}).join(", ") || "No providers"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper function to format time age
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
