"use client";

import { useState } from "react";
import { CronJob } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, ChevronDown, ChevronUp, Clock, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface CronTableProps {
  jobs: CronJob[];
  onRunNow: (jobId: string) => void;
}

function formatSchedule(schedule: CronJob["schedule"]): string {
  if (schedule.kind === "cron") {
    return schedule.expr || "Unknown";
  }
  if (schedule.kind === "every") {
    const ms = schedule.everyMs || 0;
    if (ms >= 3600000) return `Every ${ms / 3600000}h`;
    if (ms >= 60000) return `Every ${ms / 60000}m`;
    return `Every ${ms / 1000}s`;
  }
  if (schedule.kind === "at") {
    return `At ${schedule.at}`;
  }
  return "Unknown";
}

function formatNextRun(nextRun: string | null): string {
  if (!nextRun) return "—";
  const date = new Date(nextRun);
  const diff = date.getTime() - Date.now();
  
  if (diff < 0) return "Overdue";
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

function CronJobRow({
  job,
  onRunNow,
}: {
  job: CronJob;
  onRunNow: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-4 p-4 bg-zinc-800/50 rounded-lg cursor-pointer hover:bg-zinc-800 transition-colors",
          expanded && "rounded-b-none"
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-zinc-100">{job.name || job.id}</span>
            <Badge
              variant="secondary"
              className={cn(
                "text-xs",
                job.enabled
                  ? "bg-green-900/50 text-green-400"
                  : "bg-zinc-700 text-zinc-400"
              )}
            >
              {job.enabled ? "Active" : "Disabled"}
            </Badge>
            <Badge variant="secondary" className="text-xs bg-zinc-700 text-zinc-400">
              {job.sessionTarget}
            </Badge>
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-zinc-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatSchedule(job.schedule)}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Next: {formatNextRun(job.nextRun)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="bg-zinc-700 hover:bg-zinc-600"
            onClick={(e) => {
              e.stopPropagation();
              onRunNow();
            }}
            disabled={!job.enabled}
          >
            <Play className="w-4 h-4" />
          </Button>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-zinc-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="bg-zinc-800/30 rounded-b-lg p-4 border-t border-zinc-700 space-y-3">
          <div>
            <p className="text-xs text-zinc-500">Job ID</p>
            <p className="text-sm text-zinc-300 font-mono">{job.id}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Payload</p>
            <p className="text-sm text-zinc-300">
              {job.payload.kind === "systemEvent"
                ? `System Event: ${job.payload.text?.slice(0, 100)}${(job.payload.text?.length || 0) > 100 ? "..." : ""}`
                : `Agent Turn: ${job.payload.message?.slice(0, 100)}${(job.payload.message?.length || 0) > 100 ? "..." : ""}`}
            </p>
          </div>
          {job.lastRun && (
            <div>
              <p className="text-xs text-zinc-500">Last Run</p>
              <p className="text-sm text-zinc-300">
                {new Date(job.lastRun.timestamp).toLocaleString()} -{" "}
                <span
                  className={
                    job.lastRun.status === "success"
                      ? "text-green-400"
                      : "text-red-400"
                  }
                >
                  {job.lastRun.status}
                </span>
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export function CronTable({ jobs, onRunNow }: CronTableProps) {
  if (jobs.length === 0) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-100">Cron Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-zinc-500">
            No cron jobs configured
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-lg text-zinc-100">Cron Jobs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {jobs.map((job) => (
          <CronJobRow key={job.id} job={job} onRunNow={() => onRunNow(job.id)} />
        ))}
      </CardContent>
    </Card>
  );
}
