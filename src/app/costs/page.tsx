"use client";

import { useEffect, useState, useCallback } from "react";
import { CostOverview } from "@/components/costs/CostOverview";
import { ProviderBreakdown } from "@/components/costs/ProviderBreakdown";
import { CostTable } from "@/components/costs/CostTable";
import { CostTrendChart } from "@/components/costs/CostTrendChart";
import { ModelUsageChart } from "@/components/costs/ModelUsageChart";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RefreshCw, Wifi, WifiOff, Loader2, CreditCard, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGateway } from "@/providers/GatewayProvider";
import { cn } from "@/lib/utils";

interface CostSummary {
  today: number;
  week: number;
  month: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
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
}

export default function CostsPage() {
  const [data, setData] = useState<CostData | null>(null);
  const [historyData, setHistoryData] = useState<CostHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { connected, connecting, request } = useGateway();

  const fetchCosts = useCallback(async () => {
    if (!connected) return;
    
    setLoading(true);
    setError(null);
    try {
      // Fetch cost data via WebSocket
      const [costResult, historyResult] = await Promise.all([
        request<any>("usage.cost").catch(e => {
          console.error("usage.cost error:", e);
          return null;
        }),
        // History might not be available via WebSocket, fall back to HTTP
        fetch("/api/costs/history").then(r => r.ok ? r.json() : null).catch(() => null),
      ]);

      if (costResult) {
        // Transform the response to expected format
        setData({
          summary: {
            today: costResult.today ?? costResult.summary?.today ?? 0,
            week: costResult.week ?? costResult.summary?.week ?? 0,
            month: costResult.month ?? costResult.summary?.month ?? 0,
            byProvider: costResult.byProvider ?? costResult.summary?.byProvider ?? {},
            byModel: costResult.byModel ?? costResult.summary?.byModel ?? {},
          },
          raw: costResult.raw || costResult.entries || [],
          billingAccount: costResult.billingAccount || costResult.account,
          providers: costResult.providers || extractProviders(costResult),
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
  }, [connected, request]);

  // Fetch data when connected
  useEffect(() => {
    if (connected) {
      fetchCosts();
    }
  }, [connected, fetchCosts]);

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
            disabled={!connected}
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
          disabled={loading || !connected}
          className="bg-zinc-800 hover:bg-zinc-700"
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Billing Account Info */}
      {(data?.billingAccount || data?.providers?.length) && (
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
              {data?.providers?.map((provider, idx) => (
                <div key={idx} className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-zinc-400">{provider.name}</span>
                    {provider.type && (
                      <Badge variant="outline" className="text-[10px]">
                        {provider.type}
                      </Badge>
                    )}
                  </div>
                  {provider.account && (
                    <p className="font-mono text-xs text-zinc-400 truncate">{provider.account}</p>
                  )}
                  {provider.cost !== undefined && (
                    <p className="font-semibold text-zinc-100 mt-1">
                      ${provider.cost.toFixed(2)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overview Cards */}
      <CostOverview
        today={summary.today}
        week={summary.week}
        month={summary.month}
      />

      {/* Cost Trend Chart (NEW) */}
      {historyData && (
        <CostTrendChart
          daily={historyData.daily}
          weekly={historyData.weekly}
          monthly={historyData.monthly}
        />
      )}

      {/* Model and Agent Usage Charts (NEW) */}
      {historyData && (
        <ModelUsageChart
          byModel={historyData.byModel}
          byAgent={historyData.byAgent}
        />
      )}

      {/* Provider/Model Breakdown (Existing) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProviderBreakdown data={summary.byProvider} />
        <ProviderBreakdown data={summary.byModel} title="By Model" />
      </div>

      {/* Detailed Table */}
      <CostTable data={data?.raw || []} />
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
