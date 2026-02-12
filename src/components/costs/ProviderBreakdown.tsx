"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ProviderBreakdownProps {
  data: Record<string, number>;
  title?: string;
}

const COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-yellow-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-red-500",
];

export function ProviderBreakdown({ data, title = "By Provider" }: ProviderBreakdownProps) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);

  if (entries.length === 0) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-100">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-center justify-center text-zinc-500">
            No cost data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-lg text-zinc-100">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bar chart */}
        <div className="flex h-8 rounded-lg overflow-hidden bg-zinc-800">
          {entries.map(([name, value], index) => {
            const percentage = total > 0 ? (value / total) * 100 : 0;
            if (percentage < 1) return null;
            return (
              <div
                key={name}
                className={cn(COLORS[index % COLORS.length], "transition-all")}
                style={{ width: `${percentage}%` }}
                title={`${name}: $${value.toFixed(2)} (${percentage.toFixed(1)}%)`}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="space-y-2">
          {entries.map(([name, value], index) => {
            const percentage = total > 0 ? (value / total) * 100 : 0;
            return (
              <div key={name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={cn("w-3 h-3 rounded", COLORS[index % COLORS.length])}
                  />
                  <span className="text-sm text-zinc-300">{name}</span>
                </div>
                <div className="text-sm">
                  <span className="text-zinc-100 font-medium">
                    ${value.toFixed(2)}
                  </span>
                  <span className="text-zinc-500 ml-2">
                    ({percentage.toFixed(1)}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Total */}
        <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
          <span className="text-sm text-zinc-400">Total</span>
          <span className="text-lg font-bold text-zinc-100">
            ${total.toFixed(2)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
