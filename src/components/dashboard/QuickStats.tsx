"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Hash, Bot, Clock, AlertTriangle } from "lucide-react";

interface QuickStatsData {
  tokensToday: number;
  mostActiveAgent: string | null;
  cronJobsToday: number;
  errorsToday: number;
}

export function QuickStats() {
  const [stats, setStats] = useState<QuickStatsData | null>({
    tokensToday: 0,
    mostActiveAgent: "dev",
    cronJobsToday: 0,
    errorsToday: 0,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // TODO: Fetch from actual API when endpoint is available
    // setStats(...)
  }, []);

  if (loading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-100">Quick Stats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 bg-zinc-800" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const statItems = [
    {
      label: "Tokens Today",
      value: stats?.tokensToday.toLocaleString() || "0",
      icon: Hash,
    },
    {
      label: "Most Active Agent",
      value: stats?.mostActiveAgent || "—",
      icon: Bot,
    },
    {
      label: "Cron Jobs Today",
      value: stats?.cronJobsToday.toString() || "0",
      icon: Clock,
    },
    {
      label: "Errors (24h)",
      value: stats?.errorsToday.toString() || "0",
      icon: AlertTriangle,
      warning: (stats?.errorsToday ?? 0) > 0,
    },
  ];

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-lg text-zinc-100">Quick Stats</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {statItems.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50"
            >
              <div className="flex items-center gap-3">
                <item.icon
                  className={`w-4 h-4 ${
                    item.warning ? "text-yellow-500" : "text-zinc-400"
                  }`}
                />
                <span className="text-sm text-zinc-400">{item.label}</span>
              </div>
              <span
                className={`font-medium ${
                  item.warning ? "text-yellow-500" : "text-zinc-100"
                }`}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
