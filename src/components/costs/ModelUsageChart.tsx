"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface ModelUsageChartProps {
  byModel: Record<string, number>;
  byAgent: Record<string, number>;
}

const COLORS = [
  "#10b981", // emerald-500
  "#3b82f6", // blue-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#14b8a6", // teal-500
  "#f97316", // orange-500
];

const formatCost = (value: number) => `$${value.toFixed(4)}`;

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-lg">
        <p className="text-xs text-zinc-400 mb-1">
          {payload[0].payload.fullName || payload[0].payload.name}
        </p>
        <p className="text-sm font-bold text-emerald-400">
          {formatCost(payload[0].value)}
        </p>
      </div>
    );
  }
  return null;
};

export function ModelUsageChart({ byModel, byAgent }: ModelUsageChartProps) {
  const modelData = Object.entries(byModel)
    .map(([model, cost]) => ({
      name: model.split("/").pop() || model, // Show just model name, not provider/model
      fullName: model,
      cost,
    }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 10); // Top 10 models

  const agentData = Object.entries(byAgent)
    .map(([agent, cost]) => ({
      name: agent,
      cost,
    }))
    .sort((a, b) => b.cost - a.cost);

  const _renderPieLabel = (entry: { name: string; cost: number }) => {
    const percent = ((entry.cost / Object.values(byModel).reduce((a, b) => a + b, 0)) * 100).toFixed(1);
    return `${entry.name}: ${percent}%`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Model Breakdown Bar Chart */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-100">Cost by Model</CardTitle>
          <CardDescription className="text-zinc-400">
            Top 10 models by total cost
          </CardDescription>
        </CardHeader>
        <CardContent>
          {modelData.length === 0 ? (
            <div className="h-80 flex items-center justify-center">
              <p className="text-sm text-zinc-500">No model data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={modelData} margin={{ top: 5, right: 30, left: 20, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis
                  dataKey="name"
                  stroke="#71717a"
                  style={{ fontSize: "11px" }}
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis
                  stroke="#71717a"
                  style={{ fontSize: "12px" }}
                  tickFormatter={formatCost}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="cost" isAnimationActive={false} fill="#10b981" radius={[4, 4, 0, 0]}>
                  {modelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Agent Breakdown Bar Chart */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-100">Cost by Agent</CardTitle>
          <CardDescription className="text-zinc-400">
            Total cost per agent
          </CardDescription>
        </CardHeader>
        <CardContent>
          {agentData.length === 0 ? (
            <div className="h-80 flex items-center justify-center">
              <p className="text-sm text-zinc-500">No agent data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={agentData} margin={{ top: 5, right: 30, left: 20, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis
                  dataKey="name"
                  stroke="#71717a"
                  style={{ fontSize: "11px" }}
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis
                  stroke="#71717a"
                  style={{ fontSize: "12px" }}
                  tickFormatter={formatCost}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="cost" isAnimationActive={false} fill="#3b82f6" radius={[4, 4, 0, 0]}>
                  {agentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
