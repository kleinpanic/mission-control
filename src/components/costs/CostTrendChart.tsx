"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";

interface CostHistoryEntry {
  date: string;
  cost: number;
}

type ChartMode = "total" | "provider" | "model";

// Color palette for providers and models
const PROVIDER_COLORS: Record<string, string> = {
  claude: "#ef4444",   // red
  codex: "#22c55e",    // green
  openai: "#22c55e",
  google: "#3b82f6",   // blue
  gemini: "#3b82f6",   // alias
  xai: "#a855f7",      // purple
  perplexity: "#06b6d4", // cyan
};

const MODEL_COLORS: Record<string, string> = {
  "claude-sonnet-4-5": "#ef4444",
  "claude-opus-4-5-20251101": "#991b1b",
  "claude-opus-4-6": "#7f1d1d",
  "claude-haiku-4-5-20251001": "#f87171",
  "gpt-5.2": "#22c55e",
  "gpt-5.3-codex": "#16a34a",
  "gemini-3-flash-preview": "#60a5fa",
  "gemini-3-pro-preview": "#3b82f6",
  "grok-3": "#a855f7",
  "grok-3-mini": "#c084fc",
  "sonar-pro": "#06b6d4",
  "sonar": "#22d3ee",
};

function getColor(key: string, palette: Record<string, string>, index: number): string {
  if (palette[key]) return palette[key];
  const fallback = ["#8b5cf6", "#f59e0b", "#06b6d4", "#ec4899", "#84cc16", "#f97316"];
  return fallback[index % fallback.length];
}

interface CostTrendChartProps {
  daily: CostHistoryEntry[];
  weekly: CostHistoryEntry[];
  monthly: CostHistoryEntry[];
  dailyByProvider?: Record<string, CostHistoryEntry[]>;
  dailyByModel?: Record<string, CostHistoryEntry[]>;
  geminiEstimate?: CostHistoryEntry[];
}

export function CostTrendChart({ daily, weekly, monthly, dailyByProvider, dailyByModel, geminiEstimate }: CostTrendChartProps) {
  const [mode, setMode] = useState<ChartMode>("total");

  const formatCost = (value: number) => `$${value.toFixed(2)}`;

  const formatDate = (dateStr: string, granularity: "daily" | "weekly" | "monthly") => {
    const date = new Date(dateStr);
    if (granularity === "monthly") {
      return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    } else if (granularity === "weekly") {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Build merged data for multi-line charts
  const buildMultiLineData = (seriesMap: Record<string, CostHistoryEntry[]>) => {
    const dateMap: Record<string, Record<string, number>> = {};
    for (const [seriesName, entries] of Object.entries(seriesMap)) {
      for (const entry of entries) {
        if (!dateMap[entry.date]) dateMap[entry.date] = {};
        dateMap[entry.date][seriesName] = (dateMap[entry.date][seriesName] || 0) + entry.cost;
      }
    }
    return Object.entries(dateMap)
      .map(([date, values]) => ({ date, ...values }))
      .sort((a, b) => a.date.localeCompare(b.date));
  };

  const renderChart = (data: any[], granularity: "daily" | "weekly" | "monthly", lines?: { key: string; color: string; dashed?: boolean }[]) => {
    if (data.length === 0) {
      return (
        <div className="h-64 flex items-center justify-center text-zinc-500">
          No cost data available for this period
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="date"
            tickFormatter={(v) => formatDate(v, granularity)}
            stroke="#71717a"
            fontSize={11}
          />
          <YAxis
            tickFormatter={formatCost}
            stroke="#71717a"
            fontSize={11}
            width={60}
          />
          <Tooltip
            formatter={(value: any, name: any) => [formatCost(Number(value) || 0), String(name || "")]}
            labelFormatter={(label) => formatDate(label, granularity)}
            contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "8px" }}
            labelStyle={{ color: "#a1a1aa" }}
          />
          {lines ? (
            lines.map(line => (
              <Line
                key={line.key}
                type="monotone"
                dataKey={line.key}
                stroke={line.color}
                strokeWidth={2}
                strokeDasharray={line.dashed ? "5 5" : undefined}
                dot={{ r: 2, fill: line.color }}
                activeDot={{ r: 4 }}
                connectNulls
              />
            ))
          ) : (
            <Line
              type="monotone"
              dataKey="cost"
              stroke="#a78bfa"
              strokeWidth={2}
              dot={{ r: 3, fill: "#a78bfa" }}
              activeDot={{ r: 5 }}
            />
          )}
          {lines && <Legend />}
        </LineChart>
      </ResponsiveContainer>
    );
  };

  // Get chart data and lines based on mode
  const getChartConfig = (granularity: "daily" | "weekly" | "monthly") => {
    if (mode === "provider" && dailyByProvider && granularity === "daily") {
      // Add gemini estimate if available
      const allSeries = { ...dailyByProvider };
      if (geminiEstimate && geminiEstimate.length > 0) {
        allSeries["gemini (est.)"] = geminiEstimate;
      }
      const data = buildMultiLineData(allSeries);
      const lines = Object.keys(allSeries).map((key, i) => ({
        key,
        color: getColor(key.replace(" (est.)", ""), PROVIDER_COLORS, i),
        dashed: key.includes("(est.)"),
      }));
      return { data, lines };
    }
    if (mode === "model" && dailyByModel && granularity === "daily") {
      const data = buildMultiLineData(dailyByModel);
      const lines = Object.keys(dailyByModel).map((key, i) => ({
        key,
        color: getColor(key, MODEL_COLORS, i),
      }));
      return { data, lines };
    }
    // Total mode
    const map: Record<string, CostHistoryEntry[]> = { daily, weekly, monthly };
    return { data: map[granularity], lines: undefined };
  };

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-lg text-zinc-100">Cost Trends</CardTitle>
            <CardDescription className="text-zinc-400">
              {mode === "total" ? "Aggregate spend over time" : mode === "provider" ? "Spend by provider" : "Spend by model"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1">
            {(["total", "provider", "model"] as ChartMode[]).map(m => (
              <Button
                key={m}
                variant="ghost"
                size="sm"
                className={cn(
                  "text-xs px-3 py-1 h-7 rounded-md",
                  mode === m ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
                )}
                onClick={() => setMode(m)}
              >
                {m === "total" ? "Total" : m === "provider" ? "By Provider" : "By Model"}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {mode === "total" ? (
          <Tabs defaultValue="daily">
            <TabsList className="bg-zinc-800">
              <TabsTrigger value="daily">Daily</TabsTrigger>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
            </TabsList>
            <TabsContent value="daily" className="mt-4">
              {renderChart(daily, "daily")}
            </TabsContent>
            <TabsContent value="weekly" className="mt-4">
              {renderChart(weekly, "weekly")}
            </TabsContent>
            <TabsContent value="monthly" className="mt-4">
              {renderChart(monthly, "monthly")}
            </TabsContent>
          </Tabs>
        ) : (
          <>
            {mode === "provider" && geminiEstimate && geminiEstimate.length > 0 && (
              <div className="mb-3 flex items-center gap-2">
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">
                  Gemini costs are estimated from token usage ($20/mo Pro subscription)
                </Badge>
              </div>
            )}
            {(() => {
              const config = getChartConfig("daily");
              return renderChart(config.data, "daily", config.lines);
            })()}
          </>
        )}
      </CardContent>
    </Card>
  );
}
