"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp, TrendingDown, Activity, Clock, Target } from "lucide-react";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface AgentMetric {
  agent: string;
  completed: number;
  avg_duration_hours: number;
  success_rate: number;
  velocity_score: number;
}

interface TrendData {
  date: string;
  [key: string]: string | number; // agent names as keys
}

interface VelocityData {
  agents: AgentMetric[];
  trends: TrendData[];
  updated: string;
}

export default function VelocityPage() {
  const [data, setData] = useState<VelocityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchVelocity = async () => {
    try {
      const res = await fetch("/api/tasks/velocity");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      if (result.velocity) {
        // Ensure agents array exists (even if empty)
        const velocity = {
          agents: result.velocity.agents || [],
          trends: result.velocity.trends || [],
          updated: result.velocity.updated || new Date().toISOString(),
        };
        setData(velocity);
      }
    } catch (error) {
      console.error("Failed to fetch velocity data:", error);
      toast.error("Failed to load velocity metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVelocity();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchVelocity();
    setRefreshing(false);
    toast.success("Velocity metrics refreshed");
  };

  const handleSnapshot = async () => {
    try {
      const res = await fetch("/api/tasks/velocity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "snapshot" }),
      });
      const result = await res.json();
      if (result.ok) {
        toast.success("Velocity snapshot saved", {
          description: `Captured metrics for ${result.snapshot?.agents_tracked || 0} agents`,
        });
        await fetchVelocity();
      } else {
        toast.error(result.error || "Failed to save snapshot");
      }
    } catch (error) {
      console.error("Failed to save snapshot:", error);
      toast.error("Failed to save velocity snapshot");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-zinc-500 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Loading velocity metrics...
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-zinc-500">No velocity data available</div>
      </div>
    );
  }

  const topPerformer = data.agents.length > 0
    ? data.agents.reduce((best, agent) =>
        agent.velocity_score > best.velocity_score ? agent : best
      , data.agents[0])
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Agent Velocity</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Task completion rates and throughput metrics
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="bg-zinc-800 hover:bg-zinc-700"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSnapshot}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <Activity className="w-4 h-4 mr-2" />
            Save Snapshot
          </Button>
        </div>
      </div>

      {/* Top Performer Highlight */}
      {topPerformer && (
        <Card className="bg-gradient-to-r from-orange-950/30 to-zinc-900 border-orange-500/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="w-5 h-5 text-orange-400" />
              Top Performer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-orange-400">{topPerformer.agent}</p>
                <p className="text-sm text-zinc-400 mt-1">
                  {topPerformer.completed} tasks completed • {topPerformer.success_rate.toFixed(1)}% success rate
                </p>
              </div>
              <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/50 text-lg px-4 py-2">
                {topPerformer.velocity_score.toFixed(1)} velocity
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {data.agents.map((agent) => {
          const trend = agent.velocity_score > 5 ? "up" : agent.velocity_score > 2 ? "stable" : "down";
          const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Activity;
          const trendColor = trend === "up" ? "text-green-400" : trend === "down" ? "text-red-400" : "text-yellow-400";

          return (
            <Card key={agent.agent} className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{agent.agent}</CardTitle>
                  <TrendIcon className={`w-4 h-4 ${trendColor}`} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">Velocity Score</span>
                  <Badge variant="outline" className="text-zinc-300 border-zinc-700">
                    {agent.velocity_score.toFixed(1)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">Completed</span>
                  <span className="text-sm text-zinc-300">{agent.completed} tasks</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">Success Rate</span>
                  <span className="text-sm text-zinc-300">{agent.success_rate.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Avg Duration
                  </span>
                  <span className="text-sm text-zinc-300">
                    {agent.avg_duration_hours < 1
                      ? `${Math.round(agent.avg_duration_hours * 60)}m`
                      : `${agent.avg_duration_hours.toFixed(1)}h`}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Velocity Trends Chart */}
      {data.trends.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle>7-Day Velocity Trends</CardTitle>
            <CardDescription>Tasks completed per agent over the last week</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="date"
                    stroke="#71717a"
                    fontSize={12}
                    tickFormatter={(value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  />
                  <YAxis stroke="#71717a" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid #27272a",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#a1a1aa" }}
                  />
                  <Legend wrapperStyle={{ color: "#a1a1aa" }} />
                  {data.agents.map((agent, idx) => (
                    <Line
                      key={agent.agent}
                      type="monotone"
                      dataKey={agent.agent}
                      stroke={`hsl(${(idx * 360) / data.agents.length}, 70%, 50%)`}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Throughput Comparison */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle>Agent Throughput Comparison</CardTitle>
          <CardDescription>Task completion count by agent</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.agents}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="agent" stroke="#71717a" fontSize={12} />
                <YAxis stroke="#71717a" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    border: "1px solid #27272a",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "#a1a1aa" }}
                />
                <Bar dataKey="completed" fill="#ea580c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-zinc-600 text-right">
        Last updated: {new Date(data.updated).toLocaleString()}
      </div>
    </div>
  );
}
