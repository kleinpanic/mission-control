"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModelUsageAlertsProps {
  byModel: Record<string, number | { cost: number; [key: string]: any }>;
  totalMonthly: number;
}

/** Extract numeric cost from byModel value (handles both old number format and new object format) */
function extractCost(val: number | { cost: number; [key: string]: any }): number {
  return typeof val === 'number' ? val : val.cost;
}

interface ModelAlert {
  model: string;
  cost: number;
  percentage: number;
  level: "high" | "medium" | "info";
}

export function ModelUsageAlerts({ byModel, totalMonthly }: ModelUsageAlertsProps) {
  const alerts = useMemo(() => {
    if (!byModel || Object.keys(byModel).length === 0) return [];

    const result: ModelAlert[] = [];
    const total: number = Object.values(byModel).reduce<number>((sum, v) => sum + extractCost(v), 0);

    for (const [model, val] of Object.entries(byModel)) {
      const cost: number = extractCost(val);
      if (total <= 0) continue;
      const pct: number = (cost / total) * 100;

      // Flag models consuming disproportionate share
      if (pct >= 60) {
        result.push({ model, cost, percentage: pct, level: "high" });
      } else if (pct >= 35) {
        result.push({ model, cost, percentage: pct, level: "medium" });
      }
    }

    // Also flag if paid fallback (gpt-5.2 / openai) is being used
    for (const [model, val] of Object.entries(byModel)) {
      const cost: number = extractCost(val);
      if (
        cost > 0 &&
        (model.includes("gpt-5") || model.includes("openai")) &&
        !result.some((a) => a.model === model)
      ) {
        const pct = total > 0 ? (cost / total) * 100 : 0;
        result.push({ model, cost, percentage: pct, level: "high" });
      }
    }

    return result.sort((a, b) => b.cost - a.cost);
  }, [byModel, totalMonthly]);

  if (alerts.length === 0) return null;

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-400" />
          Model Usage Alerts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map((alert) => (
          <div
            key={alert.model}
            className={cn(
              "flex items-center justify-between p-2.5 rounded-lg border",
              alert.level === "high"
                ? "bg-red-950/20 border-red-800/40"
                : alert.level === "medium"
                  ? "bg-yellow-950/20 border-yellow-800/30"
                  : "bg-zinc-800/50 border-zinc-700"
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              {alert.level === "high" ? (
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              ) : (
                <TrendingUp className="w-4 h-4 text-yellow-400 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate">
                  {alert.model}
                </p>
                <p className="text-xs text-zinc-400">
                  {alert.percentage.toFixed(0)}% of total spend
                </p>
              </div>
            </div>
            <div className="text-right shrink-0 ml-2">
              <Badge
                className={cn(
                  "text-xs",
                  alert.level === "high"
                    ? "bg-red-500/20 text-red-400 border-red-500/50"
                    : "bg-yellow-500/20 text-yellow-400 border-yellow-500/50"
                )}
              >
                ${alert.cost.toFixed(2)}
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
