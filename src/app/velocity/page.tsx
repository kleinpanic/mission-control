"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { RefreshCw, TrendingUp, TrendingDown, Activity, Clock, Target, Zap, MemoryStick } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
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
  [key: string]: string | number;
}

interface VelocityData {
  agents: AgentMetric[];
  trends: TrendData[];
  updated: string;
}

interface TokenBreakdown {
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  sessionCount: number;
  color: string;
}

const MODEL_COLORS: Record<string, string> = {
  claude: "#ef4444",
  codex: "#22c55e",
  openai: "#22c55e",
  gemini: "#3b82f6",
  google: "#3b82f6",
  xai: "#eab308",
  default: "#8b5cf6",
};

function getProviderColor(model: string): string {
  const m = model.toLowerCase();
  if (m.includes("claude") || m.includes("anthropic") || m.includes("sonnet") || m.includes("opus") || m.includes("haiku")) return MODEL_COLORS.claude;
  if (m.includes("gpt") || m.includes("codex") || m.includes("openai")) return MODEL_COLORS.codex;
  if (m.includes("gemini") || m.includes("google")) return MODEL_COLORS.gemini;
  if (m.includes("grok") || m.includes("xai")) return MODEL_COLORS.xai;
  return MODEL_COLORS.default;
}

function getProviderName(model: string): string {
  const m = model.toLowerCase();
  if (m.includes("claude") || m.includes("anthropic")) return "claude";
  if (m.includes("gpt") || m.includes("codex")) return "openai";
  if (m.includes("gemini") || m.includes("google")) return "gemini";
  if (m.includes("grok") || m.includes("xai")) return "xai";
  return "other";
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

export default function VelocityPage() {
  const [data, setData] = useState<VelocityData | null>(null);
  const [tokenData, setTokenData] = useState<TokenBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchVelocity = async () => {
    try {
      const [velRes, statusRes] = await Promise.all([
        fetch("/api/tasks/velocity"),
        fetch("/api/status"),
      ]);
      const velResult = await velRes.json();
      const statusResult = statusRes.ok ? await statusRes.json() : null;

      if (velResult.velocity) {
        setData({
          agents: velResult.velocity.agents || [],
          trends: velResult.velocity.trends || [],
          updated: velResult.velocity.updated || new Date().toISOString(),
        });
      }

      // Build token breakdown from session data
      if (statusResult?.sessions?.byAgent) {
        const modelMap = new Map<string, { input: number; output: number; total: number; sessions: number }>();
        for (const ba of statusResult.sessions.byAgent) {
          for (const s of ba.recent || []) {
            const model = s.model || "unknown";
            const shortName = model.replace(/^(anthropic|openai|google|google-gemini-cli|anthropic-nick|openai-codex)\//, "").replace(/-preview$/, "");
            const existing = modelMap.get(shortName) || { input: 0, output: 0, total: 0, sessions: 0 };
            const rawInput = s.inputTokens || 0;
            const rawOutput = s.outputTokens || 0;
            const rawTotal = s.totalTokens || 0;
            // If input/output are 0 but totalTokens exists, estimate split (85/15)
            const estInput = rawInput > 0 ? rawInput : Math.round(rawTotal * 0.85);
            const estOutput = rawOutput > 0 ? rawOutput : Math.round(rawTotal * 0.15);
            existing.input += estInput;
            existing.output += estOutput;
            existing.total += rawTotal > 0 ? rawTotal : (estInput + estOutput);
            existing.sessions++;
            modelMap.set(shortName, existing);
          }
        }
        const breakdown: TokenBreakdown[] = Array.from(modelMap.entries())
          .map(([model, data]) => ({
            model,
            provider: getProviderName(model),
            inputTokens: data.input,
            outputTokens: data.output,
            totalTokens: data.total,
            sessionCount: data.sessions,
            color: getProviderColor(model),
          }))
          .sort((a, b) => b.totalTokens - a.totalTokens);
        setTokenData(breakdown);
      }
    } catch (error) {
      console.error("Failed to fetch velocity data:", error);
      toast.error("Failed to load velocity metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVelocity(); }, []);

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
        toast.success("Velocity snapshot saved", { description: `Captured metrics for ${result.snapshot?.agents_tracked || 0} agents` });
        await fetchVelocity();
      } else {
        toast.error(result.error || "Failed to save snapshot");
      }
    } catch {
      toast.error("Failed to save velocity snapshot");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-zinc-500 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />Loading velocity metrics...
        </div>
      </div>
    );
  }

  const topPerformer = data?.agents.length
    ? data.agents.reduce((best, agent) => agent.velocity_score > best.velocity_score ? agent : best, data.agents[0])
    : null;

  const totalTokensAll = tokenData.reduce((s, t) => s + t.totalTokens, 0);
  const totalInputAll = tokenData.reduce((s, t) => s + t.inputTokens, 0);
  const totalOutputAll = tokenData.reduce((s, t) => s + t.outputTokens, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Agent Velocity</h1>
          <p className="text-sm text-zinc-500 mt-1">Task throughput, token consumption, and model usage</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleRefresh} disabled={refreshing} className="bg-zinc-800 hover:bg-zinc-700">
            <RefreshCw className={cn("w-4 h-4 mr-2", refreshing && "animate-spin")} />Refresh
          </Button>
          <Button variant="default" size="sm" onClick={handleSnapshot} className="bg-orange-600 hover:bg-orange-700">
            <Activity className="w-4 h-4 mr-2" />Save Snapshot
          </Button>
        </div>
      </div>

      {/* Top Performer */}
      {topPerformer && (
        <Card className="bg-gradient-to-r from-orange-950/30 to-zinc-900 border-orange-500/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="w-5 h-5 text-orange-400" />Top Performer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-orange-400">{topPerformer.agent}</p>
                <p className="text-sm text-zinc-400 mt-1">{topPerformer.completed} tasks • {topPerformer.success_rate.toFixed(1)}% success</p>
              </div>
              <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/50 text-lg px-4 py-2">
                {topPerformer.velocity_score.toFixed(1)} velocity
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Token Consumption Breakdown — NEW */}
      {tokenData.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
                <MemoryStick className="w-5 h-5 text-purple-400" />Token Consumption by Model
              </CardTitle>
              <InfoTip content="Token usage across all active sessions. Shows input vs output tokens per model. Higher output-to-input ratios indicate more generative workloads." />
            </div>
            <CardDescription className="text-zinc-400">
              Total: {formatTokens(totalTokensAll)} tokens (Input: {formatTokens(totalInputAll)} • Output: {formatTokens(totalOutputAll)})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tokenData} layout="vertical" margin={{ left: 120, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis type="number" tickFormatter={(v) => formatTokens(v)} stroke="#71717a" fontSize={11} />
                  <YAxis type="category" dataKey="model" stroke="#71717a" fontSize={11} width={110} />
                  <Tooltip
                    formatter={(value: any, name: any) => [formatTokens(Number(value)), String(name || "")]}
                    contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "8px" }}
                    labelStyle={{ color: "#a1a1aa" }}
                  />
                  <Legend />
                  <Bar dataKey="inputTokens" name="Input" stackId="tokens" radius={[0, 0, 0, 0]}>
                    {tokenData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} fillOpacity={0.6} />
                    ))}
                  </Bar>
                  <Bar dataKey="outputTokens" name="Output" stackId="tokens" radius={[0, 4, 4, 0]}>
                    {tokenData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} fillOpacity={1} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Model detail table */}
            <div className="space-y-2">
              {tokenData.map(t => (
                <div key={t.model} className="flex items-center justify-between p-2.5 bg-zinc-800/50 rounded-lg border border-zinc-700">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                    <span className="text-sm font-mono text-zinc-200">{t.model}</span>
                    <Badge variant="outline" className="text-[9px]">{t.sessionCount} sessions</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-zinc-500">In: <span className="text-zinc-300">{formatTokens(t.inputTokens)}</span></span>
                    <span className="text-zinc-500">Out: <span className="text-zinc-300">{formatTokens(t.outputTokens)}</span></span>
                    <span className="text-zinc-400 font-semibold">{formatTokens(t.totalTokens)} total</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent Metrics Grid */}
      {data && data.agents.length > 0 && (
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
                    <TrendIcon className={cn("w-4 h-4", trendColor)} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-500">Velocity Score</span>
                    <Badge variant="outline" className="text-zinc-300 border-zinc-700">{agent.velocity_score.toFixed(1)}</Badge>
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
                    <span className="text-sm text-zinc-500 flex items-center gap-1"><Clock className="w-3 h-3" />Avg Duration</span>
                    <span className="text-sm text-zinc-300">
                      {agent.avg_duration_hours < 1 ? `${Math.round(agent.avg_duration_hours * 60)}m` : `${agent.avg_duration_hours.toFixed(1)}h`}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Velocity Trends Chart */}
      {data && data.trends.length > 0 && (
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
                  <XAxis dataKey="date" stroke="#71717a" fontSize={12} tickFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
                  <YAxis stroke="#71717a" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px" }} labelStyle={{ color: "#a1a1aa" }} />
                  <Legend wrapperStyle={{ color: "#a1a1aa" }} />
                  {data.agents.map((agent, idx) => (
                    <Line key={agent.agent} type="monotone" dataKey={agent.agent} stroke={`hsl(${(idx * 360) / data.agents.length}, 70%, 50%)`} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Throughput Comparison */}
      {data && data.agents.length > 0 && (
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
                  <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px" }} labelStyle={{ color: "#a1a1aa" }} />
                  <Bar dataKey="completed" fill="#ea580c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="text-xs text-zinc-600 text-right">
        Last updated: {data ? new Date(data.updated).toLocaleString() : "—"}
      </div>
    </div>
  );
}
