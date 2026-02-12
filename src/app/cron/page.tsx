"use client";

import { useEffect, useState } from "react";
import { CronJob } from "@/types";
import { CronTable } from "@/components/cron/CronTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw, Clock, CheckCircle, AlertCircle } from "lucide-react";

export default function CronPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCronJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gateway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "cron.list", params: { includeDisabled: true } }),
      });
      const data = await res.json();
      if (data.result?.jobs) {
        setJobs(data.result.jobs);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch cron jobs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCronJobs();
    // Refresh every minute
    const interval = setInterval(fetchCronJobs, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleRunNow = async (jobId: string) => {
    try {
      await fetch("/api/gateway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "cron.run", params: { jobId, runMode: "force" } }),
      });
      // Refresh the list
      fetchCronJobs();
    } catch (err) {
      console.error("Failed to run cron job:", err);
    }
  };

  const activeJobs = jobs.filter((j) => j.enabled);
  const disabledJobs = jobs.filter((j) => !j.enabled);

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
        <CronTable jobs={jobs} onRunNow={handleRunNow} />
      )}
    </div>
  );
}
