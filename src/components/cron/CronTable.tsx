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
  highlightJobId?: string | null;
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
  autoExpand,
}: {
  job: CronJob;
  onRunNow: () => void;
  autoExpand?: boolean;
}) {
  const [expanded, setExpanded] = useState(autoExpand || false);

  return (
    <>
      <div
        id={`cron-${job.id}`}
        className={cn(
          "flex items-center gap-4 p-4 bg-zinc-800/50 rounded-lg cursor-pointer hover:bg-zinc-800 transition-colors",
          expanded && "rounded-b-none",
          autoExpand && "ring-1 ring-emerald-500/30 bg-emerald-500/5"
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
        <div className="bg-zinc-800/30 rounded-b-lg p-4 border-t border-zinc-700 space-y-4">
          {/* Identity row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <p className="text-[10px] uppercase text-zinc-500 mb-0.5">Job ID</p>
              <p className="text-xs text-zinc-400 font-mono break-all">{job.id}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-zinc-500 mb-0.5">Target</p>
              <Badge variant="secondary" className={cn("text-xs",
                job.sessionTarget === "isolated" ? "bg-blue-900/50 text-blue-400" : "bg-amber-900/50 text-amber-400"
              )}>{job.sessionTarget}</Badge>
            </div>
            <div>
              <p className="text-[10px] uppercase text-zinc-500 mb-0.5">Schedule</p>
              <p className="text-sm text-zinc-300 font-mono">{formatSchedule(job.schedule)}</p>
              {job.schedule.tz && <p className="text-[10px] text-zinc-500">{job.schedule.tz}</p>}
            </div>
            <div>
              <p className="text-[10px] uppercase text-zinc-500 mb-0.5">Next Run</p>
              <p className="text-sm text-zinc-300">{job.nextRun ? new Date(job.nextRun).toLocaleString() : "—"}</p>
            </div>
          </div>

          {/* Payload section */}
          <div>
            <p className="text-[10px] uppercase text-zinc-500 mb-1">
              Payload — <span className={cn(
                job.payload.kind === "agentTurn" ? "text-blue-400" : "text-amber-400"
              )}>{job.payload.kind === "agentTurn" ? "Agent Turn" : "System Event"}</span>
              {job.payload.model && (
                <span className="ml-2 text-zinc-400">model: <span className="font-mono text-zinc-300">{job.payload.model}</span></span>
              )}
              {job.payload.timeoutSeconds && (
                <span className="ml-2 text-zinc-400">timeout: {job.payload.timeoutSeconds}s</span>
              )}
            </p>
            <div className="bg-zinc-900/70 rounded-lg p-3 border border-zinc-700 max-h-80 overflow-y-auto">
              <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">
                {job.payload.kind === "agentTurn"
                  ? (job.payload.message || "—").replace(/\\n/g, "\n")
                  : (job.payload.text || "—").replace(/\\n/g, "\n")}
              </pre>
            </div>
          </div>

          {/* Last run */}
          {job.lastRun && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-zinc-500">Last run:</span>
              <span className="text-zinc-300">{new Date(job.lastRun.timestamp).toLocaleString()}</span>
              <Badge className={cn("text-xs",
                job.lastRun.status === "success"
                  ? "bg-emerald-900/50 text-emerald-400"
                  : "bg-red-900/50 text-red-400"
              )}>{job.lastRun.status}</Badge>
            </div>
          )}

          {/* Agent ID if present */}
          {(job as any).agentId && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500">Agent:</span>
              <Badge variant="outline" className="text-xs">{(job as any).agentId}</Badge>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export function CronTable({ jobs, onRunNow, highlightJobId }: CronTableProps) {
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
          <CronJobRow
            key={job.id}
            job={job}
            onRunNow={() => onRunNow(job.id)}
            autoExpand={job.id === highlightJobId}
          />
        ))}
      </CardContent>
    </Card>
  );
}
