"use client";

import { useEffect, useState } from "react";
import { CostOverview } from "@/components/costs/CostOverview";
import { ProviderBreakdown } from "@/components/costs/ProviderBreakdown";
import { CostTable } from "@/components/costs/CostTable";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

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
}

export default function CostsPage() {
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCosts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/costs");
      if (!res.ok) {
        throw new Error("Failed to fetch costs");
      }
      const costData = await res.json();
      setData(costData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCosts();
  }, []);

  if (loading) {
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

  if (error) {
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
        <h1 className="text-2xl font-bold text-zinc-100">Cost Tracker</h1>
        <Button
          variant="secondary"
          size="sm"
          onClick={fetchCosts}
          className="bg-zinc-800 hover:bg-zinc-700"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Overview Cards */}
      <CostOverview
        today={summary.today}
        week={summary.week}
        month={summary.month}
      />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProviderBreakdown data={summary.byProvider} />
        <ProviderBreakdown data={summary.byModel} title="By Model" />
      </div>

      {/* Detailed Table */}
      <CostTable data={data?.raw || []} />
    </div>
  );
}
