"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface CostHistoryEntry {
  date: string;
  cost: number;
}

interface CostTrendChartProps {
  daily: CostHistoryEntry[];
  weekly: CostHistoryEntry[];
  monthly: CostHistoryEntry[];
}

export function CostTrendChart({ daily, weekly, monthly }: CostTrendChartProps) {
  const formatCost = (value: number) => `$${value.toFixed(4)}`;
  
  const formatDate = (dateStr: string, granularity: "daily" | "weekly" | "monthly") => {
    const date = new Date(dateStr);
    if (granularity === "monthly") {
      return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    } else if (granularity === "weekly") {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } else {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  };

  const CustomTooltip = ({ active, payload, label, granularity }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-lg">
          <p className="text-xs text-zinc-400 mb-1">
            {formatDate(label, granularity)}
          </p>
          <p className="text-sm font-bold text-emerald-400">
            {formatCost(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  const renderChart = (
    data: CostHistoryEntry[],
    granularity: "daily" | "weekly" | "monthly"
  ) => {
    if (data.length === 0) {
      return (
        <div className="h-80 flex items-center justify-center">
          <p className="text-sm text-zinc-500">No cost data available</p>
        </div>
      );
    }

    const chartData = data.map((entry) => ({
      ...entry,
      displayDate: formatDate(entry.date, granularity),
    }));

    return (
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="displayDate"
            stroke="#71717a"
            style={{ fontSize: "12px" }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            stroke="#71717a"
            style={{ fontSize: "12px" }}
            tickFormatter={formatCost}
          />
          <Tooltip content={<CustomTooltip granularity={granularity} />} />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          <Line
            type="monotone"
            dataKey="cost"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ fill: "#10b981", r: 4 }}
            activeDot={{ r: 6 }}
            name="Cost ($)"
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-lg text-zinc-100">Cost Trends Over Time</CardTitle>
        <CardDescription className="text-zinc-400">
          Historical cost analysis by time period
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="daily" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-zinc-800">
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
      </CardContent>
    </Card>
  );
}
