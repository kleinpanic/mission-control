"use client";

import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface OverviewCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  description?: string;
}

export function OverviewCard({
  title,
  value,
  icon: Icon,
  trend = "neutral",
  description,
}: OverviewCardProps) {
  const TrendIcon = {
    up: TrendingUp,
    down: TrendingDown,
    neutral: Minus,
  }[trend];

  const trendColor = {
    up: "text-green-500",
    down: "text-red-500",
    neutral: "text-zinc-500",
  }[trend];

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-800 rounded-lg">
              <Icon className="w-5 h-5 text-zinc-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-400">{title}</p>
              <p className="text-2xl font-bold text-zinc-100">{value}</p>
            </div>
          </div>
          <div className={cn("flex items-center gap-1", trendColor)}>
            <TrendIcon className="w-4 h-4" />
          </div>
        </div>
        {description && (
          <p className="mt-2 text-xs text-zinc-500">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
