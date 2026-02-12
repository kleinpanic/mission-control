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
} from "lucide-react";
import { useRealtimeStore } from "@/stores/realtime";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AgentInfo {
  id: string;
  name: string;
  enabled: boolean;
  status: "active" | "idle" | "waiting" | "error";
  model: string | null;
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
  };
  agents: AgentInfo[];
  sessions: {
    total: number;
    atCapacity: number;
  };
  heartbeat: {
    defaultAgentId: string;
    nextHeartbeats: { agentId: string; nextIn: string; nextInMs: number }[];
  };
  channels: string[];
}

interface CostData {
  summary: {
    today: number;
    week: number;
    month: number;
    byProvider: Record<string, number>;
    byModel: Record<string, number>;
  };
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
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  const { connectionStatus, events } = useRealtimeStore();

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, costsRes, cronRes] = await Promise.all([
        fetch("/api/status"),
        fetch("/api/costs"),
        fetch("/api/cron"),
      ]);

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setStatus(statusData);
      }

      if (costsRes.ok) {
        const costsData = await costsRes.json();
        setCosts(costsData);
      }

      if (cronRes.ok) {
        const cronData = await cronRes.json();
        setCronJobs(cronData.jobs || []);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleTriggerHeartbeat = async () => {
    setTriggering(true);
    try {
      const res = await fetch("/api/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trigger-heartbeat" }),
      });

      if (res.ok) {
        toast.success("Heartbeat triggered!");
        fetchData();
      } else {
        toast.error("Failed to trigger heartbeat");
      }
    } catch (error) {
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
  const totalAgents = status?.agents.length || 0;
  const nextHeartbeat = status?.heartbeat.nextHeartbeats[0];

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
            ) : (
              <WifiOff className="w-4 h-4" />
            )}
            {connectionStatus === "connected"
              ? "Connected"
              : connectionStatus === "connecting"
              ? "Connecting..."
              : "Disconnected"}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="bg-zinc-800 hover:bg-zinc-700"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-300">Active Agents</CardTitle>
            <Users className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-100">
              {activeAgents}/{totalAgents}
            </div>
            <p className="text-xs text-zinc-500">
              {status?.sessions.atCapacity || 0} sessions at capacity
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
            <p className="text-xs text-zinc-500">Agent: {nextHeartbeat?.agentId || "main"}</p>
          </CardContent>
        </Card>
      </div>

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
                  <Badge className={cn("text-[10px]", getStatusColor(agent.status))}>
                    {agent.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Model:</span>
                    <span className="text-zinc-200 font-mono text-xs">
                      {agent.model || "default"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Last Activity:</span>
                    <span className="text-zinc-200">{agent.lastActivityAge}</span>
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
              <p className="text-zinc-500 col-span-3 text-center py-8">Loading agents...</p>
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
              {status?.heartbeat.nextHeartbeats.slice(0, 5).map((hb, idx) => (
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
                disabled={triggering}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                <Play className={cn("w-4 h-4 mr-2", triggering && "animate-spin")} />
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
                )) || <p className="text-zinc-500 text-sm">No cron jobs scheduled</p>}
              {cronJobs.filter((job) => job.enabled).length === 0 && (
                <p className="text-zinc-500 text-sm text-center py-4">No active cron jobs</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-100">Recent Activity</CardTitle>
          <CardDescription className="text-zinc-400">Latest events from the gateway</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {events.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-8">
                No recent events. Activity will appear here when agents are active.
              </p>
            ) : (
              events.slice(0, 10).map((event, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 py-2 border-b border-zinc-800 last:border-0"
                >
                  <span className="text-xs text-zinc-500 whitespace-nowrap">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-zinc-200">{event.type}</p>
                    {event.agentId && (
                      <p className="text-xs text-zinc-500">Agent: {event.agentId}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

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
              <h4 className="text-sm font-medium text-zinc-300 mb-2">Default Model</h4>
              <p className="text-lg font-mono text-zinc-100">gpt-5.2</p>
              <p className="text-xs text-zinc-500 mt-1">Used when no model specified</p>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
              <h4 className="text-sm font-medium text-zinc-300 mb-2">Context Limit</h4>
              <p className="text-lg font-mono text-zinc-100">200k tokens</p>
              <p className="text-xs text-zinc-500 mt-1">Max context per session</p>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
              <h4 className="text-sm font-medium text-zinc-300 mb-2">Active Channels</h4>
              <p className="text-lg font-mono text-zinc-100">
                {status?.channels.length || 0}
              </p>
              <p className="text-xs text-zinc-500 mt-1">Connected messaging channels</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
