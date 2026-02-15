"use client";

import { useEffect, useState, useCallback } from "react";
import { CronJob } from "@/types";
import { CronTable } from "@/components/cron/CronTable";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Clock, CheckCircle, AlertCircle, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "active" | "disabled";
type TargetFilter = "all" | "main" | "isolated";

export default function CronPage() {
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
        <h1 className="text-2xl font-bold text-zinc-100">Cron Monitor</h1>
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
        <CronTable jobs={filteredJobs} onRunNow={handleRunNow} />
      )}
    </div>
  );
}
