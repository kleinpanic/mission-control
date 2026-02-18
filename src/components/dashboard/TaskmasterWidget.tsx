"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Clock, AlertTriangle, Zap, Play, ChevronDown, ChevronUp, ExternalLink, PauseCircle, RotateCcw, ArrowRight, Trash2 } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { InfoTip } from "@/components/ui/info-tip";

interface SlaTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  list: string;
  dueDate: string | null;
  createdAt: string;
}

interface TaskmasterStatus {
  active: boolean;
  lastTriageRun: string | null;
  intakeQueue: number;
  slaBreaches: number;
  slaBreachedTasks: SlaTask[];
  modelTiers: { flash: number; sonnet: number; opus: number; other: number };
  tasksByStatus: Record<string, number>;
  triageStale: boolean;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400 border-red-500/40 animate-pulse",
  high: "bg-red-500/20 text-red-400 border-red-500/30",
  medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  low: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  blocked: "bg-red-500/20 text-red-400",
  paused: "bg-amber-500/20 text-amber-400",
  in_progress: "bg-blue-500/20 text-blue-400",
  ready: "bg-emerald-500/20 text-emerald-400",
  review: "bg-purple-500/20 text-purple-400",
};

export function TaskmasterWidget() {
  const [status, setStatus] = useState<TaskmasterStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [slaExpanded, setSlaExpanded] = useState(false);
  const [triaging, setTriaging] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

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

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleRunTriage = async () => {
    setTriaging(true);
    try {
      await fetch("/api/taskmaster", { method: "POST" });
      // Refetch after a short delay to show updated data
      setTimeout(fetchStatus, 3000);
    } catch (error) {
      console.error("Failed to trigger triage:", error);
    } finally {
      setTimeout(() => setTriaging(false), 5000);
    }
  };

  const handleSlaAction = async (taskId: string, action: "reassign" | "deprioritize" | "dismiss" | "unblock") => {
    setActionInProgress(`${action}-${taskId}`);
    try {
      const res = await fetch("/api/taskmaster/sla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, action }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed");
      toast.success(
        action === "reassign" ? "Task queued for re-triage" :
        action === "deprioritize" ? "Task priority lowered" :
        action === "dismiss" ? "SLA breach dismissed" :
        "Task unblocked and re-queued"
      );
      setTimeout(fetchStatus, 1500);
    } catch (err: any) {
      toast.error(err.message || `Failed to ${action} task`);
    } finally {
      setActionInProgress(null);
    }
  };

  if (loading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-400" /> Taskmaster
          </CardTitle>
          <CardDescription className="text-zinc-400">Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!status) return null;

  const formatAge = (timestamp: string | null): string => {
    if (!timestamp) return "Never";
    const diff = Date.now() - new Date(timestamp).getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return "Recently";
  };

  const totalTasks = Object.values(status.modelTiers).reduce((s, c) => s + c, 0);

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-400" /> Taskmaster
              </CardTitle>
              <InfoTip content="Automated task triage system. Scans oc-tasks for new items, assigns priorities and model tiers (Flash=cheap, Sonnet=mid, Opus=expensive). SLA breaches = tasks past their expected completion time. Run Triage re-scans and reassigns." />
            </div>
            <CardDescription className="text-zinc-400">Automated task triaging &amp; assignment</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className={cn("text-xs", triaging && "animate-pulse")}
            disabled={triaging}
            onClick={handleRunTriage}
          >
            <Play className="w-3 h-3 mr-1" />
            {triaging ? "Running..." : "Run Triage"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Status row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-zinc-800/50 rounded-lg p-2.5 border border-zinc-700">
            <p className="text-[10px] uppercase text-zinc-500 flex items-center gap-1">Status <InfoTip iconSize={10} content="Whether the taskmaster is currently running a triage cycle." /></p>
            <div className="mt-1">
              {status.active ? (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Active
                </Badge>
              ) : (
                <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30 text-xs">
                  <XCircle className="w-3 h-3 mr-1" /> Idle
                </Badge>
              )}
            </div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-2.5 border border-zinc-700">
            <p className="text-[10px] uppercase text-zinc-500 flex items-center gap-1">Last Triage <InfoTip iconSize={10} content="When the taskmaster last ran a triage scan. Amber warning if stale (>24h since last run)." /></p>
            <div className="mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3 text-zinc-400" />
              <span className={cn("text-sm font-mono", status.triageStale ? "text-amber-400" : "text-zinc-200")}>
                {formatAge(status.lastTriageRun)}
              </span>
              {status.triageStale && <AlertTriangle className="w-3 h-3 text-amber-400" />}
            </div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-2.5 border border-zinc-700">
            <p className="text-[10px] uppercase text-zinc-500 flex items-center gap-1">Intake Queue <InfoTip iconSize={10} content="New tasks waiting to be triaged and assigned to an agent and model tier." /></p>
            <p className={cn("text-lg font-mono mt-0.5", status.intakeQueue > 0 ? "text-purple-400" : "text-zinc-400")}>
              {status.intakeQueue}
            </p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-2.5 border border-zinc-700">
            <p className="text-[10px] uppercase text-zinc-500 flex items-center gap-1">SLA Breaches <InfoTip iconSize={10} content="Tasks that have exceeded their expected completion deadline based on priority and complexity. High priority = shorter SLA." /></p>
            <p className={cn("text-lg font-mono mt-0.5", status.slaBreaches > 0 ? "text-red-400" : "text-emerald-400")}>
              {status.slaBreaches > 0 && <AlertTriangle className="w-4 h-4 inline mr-1" />}
              {status.slaBreaches}
            </p>
          </div>
        </div>

        {/* SLA Breach Details */}
        {status.slaBreaches > 0 && status.slaBreachedTasks.length > 0 && (
          <div className="border border-red-500/20 rounded-lg overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-3 py-2 bg-red-500/5 hover:bg-red-500/10 transition-colors"
              onClick={() => setSlaExpanded(!slaExpanded)}
            >
              <span className="text-sm font-medium text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {status.slaBreaches} SLA Breach{status.slaBreaches !== 1 ? "es" : ""}
              </span>
              <div className="flex items-center gap-2">
                {!slaExpanded && (
                  <span className="text-[10px] text-zinc-500">Click to manage</span>
                )}
                {slaExpanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
              </div>
            </button>
            {slaExpanded && (
              <div className="divide-y divide-zinc-800/50">
                {status.slaBreachedTasks.map(task => {
                  const isActing = actionInProgress?.includes(task.id);
                  const ageMs = Date.now() - new Date(task.createdAt).getTime();
                  const ageDays = Math.floor(ageMs / 86400000);
                  return (
                    <div key={task.id} className="px-3 py-3 space-y-2">
                      {/* Task info row */}
                      <div className="flex items-start gap-2">
                        <Badge className={cn("text-[9px] shrink-0 mt-0.5", PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.low)}>
                          {task.priority}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-zinc-200 truncate">{task.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge className={cn("text-[9px]", STATUS_COLORS[task.status] || "bg-zinc-500/20 text-zinc-400")}>
                              {task.status}
                            </Badge>
                            {task.assignedTo && (
                              <span className="text-[10px] text-zinc-500">→ {task.assignedTo}</span>
                            )}
                            <span className="text-[10px] text-zinc-500">{task.list}</span>
                            <span className="text-[10px] text-red-400/70">⏱ {ageDays}d overdue</span>
                          </div>
                        </div>
                      </div>
                      {/* Action buttons row */}
                      <div className="flex items-center gap-1.5 pl-7">
                        {task.status === "blocked" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[10px] px-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                                disabled={!!isActing}
                                onClick={() => handleSlaAction(task.id, "unblock")}
                              >
                                <RotateCcw className="w-3 h-3 mr-1" />
                                Unblock
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Move task back to &quot;ready&quot; status so it can be picked up again</TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-[10px] px-2 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                              disabled={!!isActing}
                              onClick={() => handleSlaAction(task.id, "reassign")}
                            >
                              <ArrowRight className="w-3 h-3 mr-1" />
                              Re-triage
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Put task back in intake queue for re-assignment to a different agent or model tier</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-[10px] px-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                              disabled={!!isActing}
                              onClick={() => handleSlaAction(task.id, "deprioritize")}
                            >
                              <PauseCircle className="w-3 h-3 mr-1" />
                              Lower Priority
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Reduce task priority (extends the SLA deadline). Use when the task is still valid but not urgent.</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-[10px] px-2 border-zinc-600 text-zinc-400 hover:bg-zinc-800"
                              disabled={!!isActing}
                              onClick={() => handleSlaAction(task.id, "dismiss")}
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Dismiss
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Clear the SLA breach flag. Task stays in its current status but the overdue warning is removed.</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

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
                    <span className="w-2 h-2 rounded-full bg-emerald-400" /> Flash (cheap)
                  </span>
                  <span className="text-zinc-300 font-mono">{status.modelTiers.flash}</span>
                </div>
              )}
              {status.modelTiers.sonnet > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-yellow-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-yellow-400" /> Sonnet (standard)
                  </span>
                  <span className="text-zinc-300 font-mono">{status.modelTiers.sonnet}</span>
                </div>
              )}
              {status.modelTiers.opus > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-red-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-400" /> Opus (premium)
                  </span>
                  <span className="text-zinc-300 font-mono">{status.modelTiers.opus}</span>
                </div>
              )}
              {status.modelTiers.other > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-zinc-400" /> Other
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
