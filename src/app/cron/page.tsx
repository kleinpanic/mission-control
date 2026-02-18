"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { CronJob } from "@/types";
import { CronTable } from "@/components/cron/CronTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Clock, CheckCircle, AlertCircle, Filter, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { InfoTip } from "@/components/ui/info-tip";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

type StatusFilter = "all" | "active" | "disabled";
type TargetFilter = "all" | "main" | "isolated";

/** Parse cron expression hour/minute into decimal hour */
function parseCronTime(schedule: any): number | null {
  if (schedule?.kind === "cron" && schedule?.expr) {
    const parts = schedule.expr.split(/\s+/);
    if (parts.length >= 2) {
      const minute = parseInt(parts[0], 10);
      const hour = parseInt(parts[1], 10);
      if (!isNaN(hour) && !isNaN(minute)) return hour + minute / 60;
    }
  }
  return null;
}

/** CronTimeline — 24h visual timeline */
function CronTimeline({ jobs }: { jobs: CronJob[] }) {
  const mapped = jobs
    .map(j => ({ job: j, hour: parseCronTime(j.schedule) }))
    .filter((x): x is { job: CronJob; hour: number } => x.hour !== null)
    .sort((a, b) => a.hour - b.hour);

  if (mapped.length === 0) return <p className="text-zinc-500 text-sm">No cron expressions to visualize</p>;

  // Detect conflicts (within 30 min of each other)
  const conflictSet = new Set<string>();
  for (let i = 0; i < mapped.length - 1; i++) {
    const diff = Math.abs(mapped[i + 1].hour - mapped[i].hour);
    if (diff < 0.5) {
      conflictSet.add(mapped[i].job.id);
      conflictSet.add(mapped[i + 1].job.id);
    }
  }

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="space-y-3">
      {/* Hour ruler */}
      <div className="relative h-10">
        <div className="absolute inset-x-0 top-4 h-px bg-zinc-700" />
        {hours.map(h => (
          <div key={h} className="absolute top-0" style={{ left: `${(h / 24) * 100}%` }}>
            <div className="w-px h-2 bg-zinc-600 mx-auto" />
            {h % 3 === 0 && (
              <span className="text-[9px] text-zinc-500 absolute -translate-x-1/2 top-4">
                {h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`}
              </span>
            )}
          </div>
        ))}
        {/* Day/night zones */}
        <div className="absolute top-3 h-1 rounded-full bg-amber-500/10" style={{ left: `${(5 / 24) * 100}%`, width: `${(12 / 24) * 100}%` }} />
        <div className="absolute top-3 h-1 rounded-full bg-indigo-500/10" style={{ left: `${(17 / 24) * 100}%`, width: `${(7 / 24) * 100}%` }} />
        <div className="absolute top-3 h-1 rounded-full bg-indigo-500/10" style={{ left: "0%", width: `${(5 / 24) * 100}%` }} />
      </div>

      {/* Job markers */}
      <div className="relative h-auto min-h-[60px]">
        {mapped.map(({ job, hour }, i) => {
          const left = (hour / 24) * 100;
          const isConflict = conflictSet.has(job.id);
          const timeStr = `${Math.floor(hour)}:${String(Math.round((hour % 1) * 60)).padStart(2, "0")}`;
          return (
            <Tooltip key={job.id}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "absolute inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium cursor-default border transition-colors",
                    isConflict
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/40"
                      : "bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-zinc-500"
                  )}
                  style={{ left: `${Math.min(left, 88)}%`, top: `${(i % 3) * 24}px` }}
                >
                  {hour >= 5 && hour < 17 ? "☀️" : "🌙"}
                  {job.name?.replace(/-/g, " ").slice(0, 18) || job.id.slice(0, 12)}
                  {isConflict && <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-semibold">{job.name || job.id}</p>
                <p>Fires at {timeStr} • {job.schedule?.expr || "—"}</p>
                <p>Target: {job.sessionTarget || "isolated"}</p>
                {isConflict && <p className="text-amber-400 mt-1">⚠️ Within 30min of another job</p>}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-zinc-500 pt-1">
        <span>☀️ Daytime (5am–5pm)</span>
        <span>🌙 Nighttime (5pm–5am)</span>
        <span className="text-amber-400">⚠️ Potential conflict (&lt;30min gap)</span>
      </div>
    </div>
  );
}

export default function CronPage() {
  const searchParams = useSearchParams();
  const highlightJobId = searchParams.get("highlight");
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [targetFilter, setTargetFilter] = useState<TargetFilter>("all");

  const fetchCronJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cron");
      const data = await res.json();
      if (data.jobs) {
        setJobs(data.jobs);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch cron jobs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCronJobs();
    // Refresh every minute
    const interval = setInterval(fetchCronJobs, 60000);
    return () => clearInterval(interval);
  }, [fetchCronJobs]);

  const handleRunNow = async (jobId: string) => {
    try {
      await fetch("/api/cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run", jobId }),
      });
      // Refresh the list
      fetchCronJobs();
    } catch (err) {
      console.error("Failed to run cron job:", err);
    }
  };

  const activeJobs = jobs.filter((j) => j.enabled);
  const disabledJobs = jobs.filter((j) => !j.enabled);

  // Apply filters
  const filteredJobs = jobs.filter((j) => {
    if (statusFilter === "active" && !j.enabled) return false;
    if (statusFilter === "disabled" && j.enabled) return false;
    if (targetFilter === "main" && j.sessionTarget !== "main") return false;
    if (targetFilter === "isolated" && j.sessionTarget !== "isolated") return false;
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-zinc-100">Cron Monitor</h1>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 bg-zinc-800" />
          ))}
        </div>
        <Skeleton className="h-96 bg-zinc-800" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-zinc-100">Cron Monitor</h1>
            <InfoTip content="Scheduled recurring jobs managed by OpenClaw. 'Protected' jobs cannot be disabled from the UI (they're marked as critical in config). Session targets: 'main' runs in the primary session, 'isolated' runs in a sandboxed sub-session." />
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={fetchCronJobs}
          className="bg-zinc-800 hover:bg-zinc-700"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-zinc-800">
                <Clock className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-zinc-400">Total Jobs</p>
                <p className="text-2xl font-bold text-zinc-100">{jobs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-zinc-800">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-zinc-400">Active</p>
                <p className="text-2xl font-bold text-zinc-100">{activeJobs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-zinc-800">
                <AlertCircle className="w-6 h-6 text-zinc-400" />
              </div>
              <div>
                <p className="text-sm text-zinc-400">Disabled</p>
                <p className="text-2xl font-bold text-zinc-100">{disabledJobs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline Visualization */}
      {activeJobs.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg text-zinc-100">Daily Timeline</CardTitle>
              <InfoTip content="Visual layout of when cron jobs fire during the day. Jobs within 30 minutes of each other are flagged as potentially conflicting (orange outline). Time shown in local timezone." />
            </div>
          </CardHeader>
          <CardContent>
            <CronTimeline jobs={activeJobs} />
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-zinc-500" />
          <span className="text-sm text-zinc-500">Status:</span>
          {(["all", "active", "disabled"] as StatusFilter[]).map((f) => (
            <Button
              key={f}
              variant={statusFilter === f ? "default" : "outline"}
              size="sm"
              className={cn(
                "h-7 text-xs",
                statusFilter === f
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                  : "border-zinc-700 text-zinc-400 hover:text-zinc-200"
              )}
              onClick={() => setStatusFilter(f)}
            >
              {f === "all" ? "All" : f === "active" ? "Active" : "Disabled"}
              {f !== "all" && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px] bg-zinc-700">
                  {f === "active" ? activeJobs.length : disabledJobs.length}
                </Badge>
              )}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-zinc-500">Target:</span>
          {(["all", "main", "isolated"] as TargetFilter[]).map((f) => (
            <Button
              key={f}
              variant={targetFilter === f ? "default" : "outline"}
              size="sm"
              className={cn(
                "h-7 text-xs",
                targetFilter === f
                  ? "bg-blue-600 hover:bg-blue-500 text-white"
                  : "border-zinc-700 text-zinc-400 hover:text-zinc-200"
              )}
              onClick={() => setTargetFilter(f)}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>
        <span className="text-xs text-zinc-600 ml-auto">
          Showing {filteredJobs.length} of {jobs.length} jobs
        </span>
      </div>

      {/* Jobs Table */}
      {error ? (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-6">
            <div className="text-center text-red-400">
              <AlertCircle className="w-8 h-8 mx-auto mb-2" />
              <p>{error}</p>
              <Button variant="secondary" className="mt-4" onClick={fetchCronJobs}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <CronTable jobs={filteredJobs} onRunNow={handleRunNow} highlightJobId={highlightJobId} />
      )}
    </div>
  );
}
