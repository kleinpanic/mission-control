"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, AlertTriangle, Zap } from "lucide-react";

interface TaskmasterStatus {
  active: boolean;
  lastTriageRun: string | null;
  intakeQueue: number;
  slaBreaches: number;
  modelTiers: {
    flash: number;
    sonnet: number;
    opus: number;
    other: number;
  };
}

export function TaskmasterWidget() {
  const [status, setStatus] = useState<TaskmasterStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/taskmaster");
        const data = await res.json();
        setStatus(data);
      } catch (error) {
        console.error("Failed to fetch taskmaster status:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    // Refresh every 60 seconds
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-400" />
            Taskmaster
          </CardTitle>
          <CardDescription className="text-zinc-400">Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!status) {
    return null;
  }

  const formatAge = (timestamp: string | null): string => {
    if (!timestamp) return "Unknown";
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "Just now";
  };

  const totalTasks = Object.values(status.modelTiers).reduce((sum, count) => sum + count, 0);

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
          <Zap className="w-5 h-5 text-purple-400" />
          Taskmaster
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Automated task triaging &amp; assignment
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-400">Status:</span>
          {status.active ? (
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/50">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Active
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-zinc-500/10 text-zinc-400 border-zinc-500/50">
              <XCircle className="w-3 h-3 mr-1" />
              Idle
            </Badge>
          )}
        </div>

        {/* Last Triage */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-400">Last Triage:</span>
          <span className="text-sm text-zinc-200 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatAge(status.lastTriageRun)}
          </span>
        </div>

        {/* Intake Queue */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-400">Intake Queue:</span>
          <Badge
            variant="outline"
            className={
              status.intakeQueue > 0
                ? "bg-purple-500/10 text-purple-400 border-purple-500/50"
                : "bg-zinc-500/10 text-zinc-400 border-zinc-500/50"
            }
          >
            {status.intakeQueue} pending
          </Badge>
        </div>

        {/* SLA Breaches */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-400">SLA Breaches:</span>
          <Badge
            variant="outline"
            className={
              status.slaBreaches > 0
                ? "bg-red-500/10 text-red-400 border-red-500/50"
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/50"
            }
          >
            {status.slaBreaches > 0 && <AlertTriangle className="w-3 h-3 mr-1" />}
            {status.slaBreaches}
          </Badge>
        </div>

        {/* Model Tier Breakdown */}
        <div className="pt-2 border-t border-zinc-800">
          <h4 className="text-xs font-medium text-zinc-400 mb-2">Active Tasks by Model Tier</h4>
          {totalTasks === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-2">No active tasks</p>
          ) : (
            <div className="space-y-1.5">
              {status.modelTiers.flash > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    Flash (cheap)
                  </span>
                  <span className="text-zinc-300 font-mono">{status.modelTiers.flash}</span>
                </div>
              )}
              {status.modelTiers.sonnet > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-yellow-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-yellow-400" />
                    Sonnet (standard)
                  </span>
                  <span className="text-zinc-300 font-mono">{status.modelTiers.sonnet}</span>
                </div>
              )}
              {status.modelTiers.opus > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-red-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-400" />
                    Opus (premium)
                  </span>
                  <span className="text-zinc-300 font-mono">{status.modelTiers.opus}</span>
                </div>
              )}
              {status.modelTiers.other > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-zinc-400" />
                    Other
                  </span>
                  <span className="text-zinc-300 font-mono">{status.modelTiers.other}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
