"use client";

import { useEffect, useState, useCallback } from "react";
import { CostOverview } from "@/components/costs/CostOverview";
// ProviderBreakdown replaced with inline provider/agent cards
import { CostTable } from "@/components/costs/CostTable";
import { CostTrendChart } from "@/components/costs/CostTrendChart";
import { ModelUsageChart } from "@/components/costs/ModelUsageChart";
import { BudgetAlerts } from "@/components/costs/BudgetAlerts";
import { ModelUsageAlerts } from "@/components/costs/ModelUsageAlerts";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, Wifi, WifiOff, Loader2, CreditCard, Building2, Users, Bot } from "lucide-react";
import { InfoTip } from "@/components/ui/info-tip";
import { Button } from "@/components/ui/button";
import { useGateway } from "@/providers/GatewayProvider";
import { cn } from "@/lib/utils";

interface CostSummary {
  today: number;
  week: number;
  month: number;
  byProvider: Record<string, number>;
  byModel: Record<string, any>; // value can be number or {cost, inputTokens, outputTokens, sessions, pricing}
  byAgent?: Record<string, { cost: number; tokens: number; sessions: number; models: string[] }>;
}

interface CostData {
  summary: CostSummary;
  raw: any[];
  billingAccount?: string;
  providers?: {
    name: string;
    account?: string;
    type?: string;
    cost?: number;
  }[];
}

interface CostHistoryEntry {
  date: string;
  cost: number;
}

interface CostHistoryData {
  daily: CostHistoryEntry[];
  weekly: CostHistoryEntry[];
  monthly: CostHistoryEntry[];
  byAgent: Record<string, number>;
  byModel: Record<string, number>;
  byProvider: Record<string, number>;
}

export default function CostsPage() {
  const [data, setData] = useState<CostData | null>(null);
  const [historyData, setHistoryData] = useState<CostHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { connected, connecting, request } = useGateway();

  const fetchCosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Use HTTP APIs exclusively — avoids WS operator.read scope errors
      const [finalCostResult, historyResult] = await Promise.all([
        fetch("/api/costs").then(r => r.ok ? r.json() : null).catch(() => null),
        fetch("/api/costs/history").then(r => r.ok ? r.json() : null).catch(() => null),
      ]);

      if (finalCostResult) {
        console.log('[Costs] Data received:', finalCostResult);
        
        // Handle both raw codexbar format and aggregated format
        let summary;
        if (finalCostResult.summary) {
          summary = finalCostResult.summary;
        } else {
          // Calculate summary from raw data if missing (e.g. from WebSocket)
          const daily = finalCostResult.daily || [];
          const _totals = finalCostResult.totals || {};
          
          const now = new Date();
          // Use local date for "today" comparison (not UTC) to match user's timezone
          const localOffset = now.getTimezoneOffset() * 60 * 1000;
          const localDate = new Date(now.getTime() - localOffset);
          const nowStr = localDate.toISOString().slice(0, 10);
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
          
          const todayEntry = daily.find((d: any) => d.date === nowStr);
          
          // Calculate week and month from daily entries if not provided
          let weekCost = 0;
          let monthCost = 0;
          for (const day of daily) {
            const dayDate = day.date;
            const dayCost = day.totalCost ?? 0;
            if (dayDate >= weekAgo) {
              weekCost += dayCost;
            }
            if (dayDate >= monthStart) {
              monthCost += dayCost;
            }
          }
          
          summary = {
            today: todayEntry?.totalCost ?? finalCostResult.today ?? 0,
            week: finalCostResult.week ?? weekCost,
            month: finalCostResult.month ?? monthCost,
            byProvider: finalCostResult.byProvider ?? {},
            byModel: finalCostResult.byModel ?? {},
          };
        }

        setData({
          summary: {
            today: summary.today ?? 0,
            week: summary.week ?? 0,
            month: summary.month ?? 0,
            byProvider: summary.byProvider ?? {},
            byModel: summary.byModel ?? {},
          },
          raw: finalCostResult.raw || finalCostResult.entries || finalCostResult.daily || [],
          billingAccount: finalCostResult.billingAccount || finalCostResult.account,
          providers: finalCostResult.providers || extractProviders(finalCostResult),
        });
      }

      if (historyResult) {
        setHistoryData(historyResult);
      }
    } catch (err) {
      console.error("Failed to fetch costs:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch data on mount (HTTP-only, no WS dependency)
  useEffect(() => {
    fetchCosts();
  }, [fetchCosts]);

  // Connection status
  const connectionStatus = connected ? "connected" : connecting ? "connecting" : "disconnected";

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-zinc-100">Cost Tracker</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 bg-zinc-800" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 bg-zinc-800" />
          <Skeleton className="h-80 bg-zinc-800" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-zinc-100">Cost Tracker</h1>
        </div>
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-6 text-center">
          <p className="text-red-400">{error}</p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={fetchCosts}
            disabled={loading}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const summary = {
    today: data?.summary?.today ?? 0,
    week: data?.summary?.week ?? 0,
    month: data?.summary?.month ?? 0,
    byProvider: data?.summary?.byProvider ?? {},
    byModel: data?.summary?.byModel ?? {},
    byAgent: data?.summary?.byAgent,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-zinc-100">Cost Tracker</h1>
          {/* Connection indicator */}
          <Badge
            variant="outline"
            className={cn(
              "text-xs",
              connectionStatus === "connected"
                ? "border-emerald-500/50 text-emerald-400"
                : connectionStatus === "connecting"
                ? "border-yellow-500/50 text-yellow-400"
                : "border-red-500/50 text-red-400"
            )}
          >
            {connectionStatus === "connected" ? (
              <Wifi className="w-3 h-3 mr-1" />
            ) : connectionStatus === "connecting" ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <WifiOff className="w-3 h-3 mr-1" />
            )}
            {connectionStatus === "connected" 
              ? "Live" 
              : connectionStatus === "connecting" 
              ? "Connecting" 
              : "Offline"}
          </Badge>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={fetchCosts}
          disabled={loading}
          className="bg-zinc-800 hover:bg-zinc-700"
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Billing Account Info */}
      {(data?.billingAccount || (data?.providers?.length ?? 0) > 0) && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Billing Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {data?.billingAccount && (
                <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="w-4 h-4 text-zinc-400" />
                    <span className="text-xs text-zinc-400">Account</span>
                  </div>
                  <p className="font-mono text-sm text-zinc-100">{data.billingAccount}</p>
                </div>
              )}
              {data?.providers?.map((provider: any, idx: number) => {
                const provCost = provider.monthlyCost ?? provider.cost ?? 0;
                const provColor = provider.color;
                return (
                  <div key={idx} className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {provColor && <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: provColor }} />}
                        <span className="text-sm font-medium text-zinc-200">{provider.name}</span>
                      </div>
                      {provider.type && (
                        <Badge variant="outline" className="text-[10px]">
                          {provider.type}
                        </Badge>
                      )}
                    </div>
                    {provider.icon && (
                      <p className="text-xs text-zinc-500">{provider.icon} {provider.description || provider.trackingMethod || ""}</p>
                    )}
                    {provider.account && (
                      <p className="font-mono text-xs text-zinc-500 truncate">{provider.account}</p>
                    )}
                    <p className={cn("text-xl font-bold mt-2", provCost > 0 ? "text-zinc-100" : "text-zinc-500")}>
                      {provCost > 0 ? `$${provCost.toFixed(2)}` : "$0.00"}
                    </p>
                    {provider.trackingMethod === "session-tokens" && (
                      <span className="text-[10px] text-amber-500/80">⚡ Estimated from session tokens</span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overview Cards */}
      {summary.today === 0 && summary.week === 0 && summary.month === 0 && (
        <Card className="bg-yellow-900/20 border-yellow-800">
          <CardContent className="p-4">
            <p className="text-yellow-400 text-sm">
              ℹ️ No cost data available yet. Cost tracking requires OpenClaw usage data. 
              Check the gateway logs or run <code className="bg-zinc-800 px-1 rounded">codexbar cost</code> to verify usage tracking.
            </p>
          </CardContent>
        </Card>
      )}
      <CostOverview
        today={summary.today}
        week={summary.week}
        month={summary.month}
      />

      {/* Budget Alerts & Model Usage Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BudgetAlerts
          currentDaily={summary.today}
          currentWeekly={summary.week}
          currentMonthly={summary.month}
        />
        <ModelUsageAlerts
          byModel={summary.byModel}
          totalMonthly={summary.month}
        />
      </div>

      {/* Cost Trend Chart */}
      {historyData && (
        <CostTrendChart
          daily={historyData.daily}
          weekly={historyData.weekly}
          monthly={historyData.monthly}
          dailyByProvider={(historyData as any).dailyByProvider}
          dailyByModel={(historyData as any).dailyByModel}
          geminiEstimate={(historyData as any).geminiEstimate}
        />
      )}

      {/* Model and Agent Usage Charts (NEW) */}
      {historyData && (
        <ModelUsageChart
          byModel={historyData.byModel}
          byAgent={historyData.byAgent}
        />
      )}

      {/* Provider Details + Agent Cost Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Provider Breakdown with pricing details */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base text-zinc-100">By Provider</CardTitle>
              <InfoTip content="Monthly cost per API provider. Token-based costs use per-model API pricing. Claude & Codex from codexbar (authoritative). Others estimated from session token counts." />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[350px] overflow-y-auto">
              {(data as any)?.providers?.length > 0
                ? (data as any).providers
                    .filter((p: any) => p.monthlyCost > 0)
                    .sort((a: any, b: any) => b.monthlyCost - a.monthlyCost)
                    .map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between p-2.5 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                          <div>
                            <span className="text-sm font-medium text-zinc-200">{p.name}</span>
                            <p className="text-xs text-zinc-500">{p.icon} {p.description}</p>
                            {p.trackingMethod === "session-tokens" && (
                              <span className="text-[10px] text-amber-500/80">⚡ Estimated from session tokens</span>
                            )}
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-zinc-100">${p.monthlyCost.toFixed(2)}</span>
                      </div>
                    ))
                : Object.entries(historyData?.byProvider || summary.byProvider)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([name, cost]) => (
                      <div key={name} className="flex items-center justify-between p-2 bg-zinc-800/50 rounded">
                        <span className="text-sm text-zinc-300 capitalize">{name}</span>
                        <span className="text-sm font-medium text-zinc-100">${(cost as number).toFixed(2)}</span>
                      </div>
                    ))
              }
              {Object.keys(summary.byProvider).length === 0 && !(data as any)?.providers?.length && (
                <p className="text-sm text-zinc-500 text-center py-4">No provider data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Agent Cost Breakdown — scrollable */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base text-zinc-100">By Agent</CardTitle>
              <InfoTip content="Estimated per-agent costs from current sessions. Based on session token counts × model API pricing. Only includes active/recent sessions, not historical." />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[350px] overflow-y-auto">
              {summary.byAgent && Object.keys(summary.byAgent).length > 0
                ? Object.entries(summary.byAgent)
                    .sort(([, a], [, b]) => b.cost - a.cost)
                    .map(([agentId, info]) => (
                      <div key={agentId} className="flex items-center justify-between p-2.5 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                        <div className="flex items-center gap-2.5">
                          <Bot className="w-4 h-4 text-zinc-500" />
                          <div>
                            <span className="text-sm font-medium text-zinc-200">{agentId}</span>
                            <div className="flex items-center gap-2 text-xs text-zinc-500">
                              <span>{info.sessions} sessions</span>
                              <span>•</span>
                              <span>{info.tokens > 1000000 ? `${(info.tokens / 1000000).toFixed(1)}M` : info.tokens > 1000 ? `${Math.floor(info.tokens / 1000)}k` : info.tokens} tokens</span>
                            </div>
                            {info.models.length > 0 && (
                              <div className="flex gap-1 mt-0.5 flex-wrap">
                                {info.models.slice(0, 3).map(m => (
                                  <Badge key={m} variant="outline" className="text-[9px] h-4 px-1 border-zinc-600 text-zinc-400">{m.split('-').slice(-2).join('-')}</Badge>
                                ))}
                                {info.models.length > 3 && <span className="text-[9px] text-zinc-500">+{info.models.length - 3}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                        <span className={cn("text-sm font-semibold", info.cost > 0 ? "text-zinc-100" : "text-zinc-500")}>
                          {info.cost > 0 ? `$${info.cost.toFixed(2)}` : "—"}
                        </span>
                      </div>
                    ))
                : historyData?.byAgent && Object.keys(historyData.byAgent).length > 0
                  ? Object.entries(historyData.byAgent)
                      .sort(([, a], [, b]) => b - a)
                      .map(([name, cost]) => (
                        <div key={name} className="flex items-center justify-between p-2 bg-zinc-800/50 rounded">
                          <span className="text-sm text-zinc-300">{name}</span>
                          <span className="text-sm font-medium text-zinc-100">${cost.toFixed(2)}</span>
                        </div>
                      ))
                  : <p className="text-sm text-zinc-500 text-center py-4">No agent cost data available</p>
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* By Model (detailed with pricing info) */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base text-zinc-100">By Model</CardTitle>
            <InfoTip content="Per-model cost breakdown. Shows per-model token pricing (input/output per 1M tokens), total tokens consumed, and estimated cost." />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {Object.entries(summary.byModel).length > 0
              ? Object.entries(summary.byModel)
                  .sort(([, a], [, b]) => {
                    const costA = typeof a === 'number' ? a : a.cost;
                    const costB = typeof b === 'number' ? b : b.cost;
                    return costB - costA;
                  })
                  .map(([model, info]) => {
                    const cost = typeof info === 'number' ? info : info.cost;
                    const inputTokens = typeof info === 'object' ? info.inputTokens : 0;
                    const outputTokens = typeof info === 'object' ? info.outputTokens : 0;
                    const sessions = typeof info === 'object' ? info.sessions : undefined;
                    const pricing = typeof info === 'object' ? info.pricing : undefined;
                    return (
                      <div key={model} className="p-2.5 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                        <div className="flex items-center justify-between">
                          <div>
                            <code className="text-sm font-mono text-zinc-200">{model}</code>
                            {sessions && <span className="text-xs text-zinc-500 ml-2">({sessions} sessions)</span>}
                          </div>
                          <span className={cn("text-sm font-semibold", cost > 0 ? "text-zinc-100" : "text-zinc-500")}>
                            {cost > 0 ? `$${cost.toFixed(2)}` : "—"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                          {pricing && <span className="text-emerald-500/70">{pricing}</span>}
                          {(inputTokens > 0 || outputTokens > 0) && (
                            <span>
                              {inputTokens > 1000000 ? `${(inputTokens / 1000000).toFixed(1)}M` : `${Math.floor(inputTokens / 1000)}k`} in
                              {" / "}
                              {outputTokens > 1000000 ? `${(outputTokens / 1000000).toFixed(1)}M` : `${Math.floor(outputTokens / 1000)}k`} out
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
              : <p className="text-sm text-zinc-500 text-center py-4">No model cost data available</p>
            }
          </div>
        </CardContent>
      </Card>

      {/* Detailed Table */}
      <CostTable data={(historyData as any)?.dailyDetails || data?.raw || []} />
    </div>
  );
}

// Helper to extract provider info from cost result
function extractProviders(result: any): { name: string; account?: string; cost?: number }[] {
  const providers: { name: string; account?: string; cost?: number }[] = [];
  
  const byProvider = result.byProvider || result.summary?.byProvider;
  if (byProvider) {
    for (const [name, cost] of Object.entries(byProvider)) {
      providers.push({ name, cost: cost as number });
    }
  }
  
  return providers;
}
