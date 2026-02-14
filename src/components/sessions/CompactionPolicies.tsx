"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Settings2,
  Minimize2,
  Trash2,
  Shield,
  Clock,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Session } from "@/types";
import { useGateway } from "@/providers/GatewayProvider";
import { toast } from "sonner";

interface CompactionPolicy {
  autoCompactThreshold: number; // percentage (0-100)
  autoCompactEnabled: boolean;
  staleSessionHours: number; // hours before a session is "stale"
  stalePruneEnabled: boolean;
  protectedAgents: string[]; // agents that should never be auto-pruned
}

const STORAGE_KEY = "mission-control-compaction-policy";

const DEFAULT_POLICY: CompactionPolicy = {
  autoCompactThreshold: 90,
  autoCompactEnabled: false,
  staleSessionHours: 48,
  stalePruneEnabled: false,
  protectedAgents: ["main", "dev"],
};

function loadPolicy(): CompactionPolicy {
  if (typeof window === "undefined") return DEFAULT_POLICY;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_POLICY, ...JSON.parse(stored) };
  } catch {
    // ignore
  }
  return DEFAULT_POLICY;
}

function savePolicy(policy: CompactionPolicy) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(policy));
}

function getAgentFromKey(key: string): string {
  const parts = key.split(":");
  return parts[1] || "unknown";
}

interface CompactionPoliciesProps {
  sessions: Session[];
  onRefresh?: () => void;
}

export function CompactionPolicies({ sessions, onRefresh }: CompactionPoliciesProps) {
  const [policy, setPolicy] = useState<CompactionPolicy>(DEFAULT_POLICY);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CompactionPolicy>(DEFAULT_POLICY);
  const [running, setRunning] = useState(false);
  const { connected, request } = useGateway();

  useEffect(() => {
    const loaded = loadPolicy();
    setPolicy(loaded);
    setDraft(loaded);
  }, []);

  const handleSave = useCallback(() => {
    savePolicy(draft);
    setPolicy(draft);
    setEditing(false);
    toast.success("Compaction policies saved");
  }, [draft]);

  const handleCancel = useCallback(() => {
    setDraft(policy);
    setEditing(false);
  }, [policy]);

  // Identify sessions that match policies
  const compactCandidates = sessions.filter((s) => {
    if (!s.tokens) return false;
    const pct = Math.round((s.tokens.used / s.tokens.limit) * 100);
    return pct >= policy.autoCompactThreshold;
  });

  const staleCandidates = sessions.filter((s) => {
    const agent = getAgentFromKey(s.key);
    if (policy.protectedAgents.includes(agent)) return false;
    if (!s.lastActivity) return false;
    const hoursSinceActivity =
      (Date.now() - new Date(s.lastActivity).getTime()) / (1000 * 60 * 60);
    return hoursSinceActivity >= policy.staleSessionHours;
  });

  const runCompaction = async () => {
    if (!connected || compactCandidates.length === 0) return;
    setRunning(true);
    let reset = 0;
    let failed = 0;
    for (const session of compactCandidates) {
      try {
        // Note: sessions.compact does not exist in the gateway API.
        // We use sessions.reset to clear high-usage sessions instead.
        // Compaction happens automatically during agent runs when context is near limit.
        await request("sessions.reset", { key: session.key });
        reset++;
      } catch (err) {
        console.error(`[Compaction] Failed to reset session ${session.key}:`, err);
        failed++;
      }
    }
    if (reset > 0) {
      toast.success(`Reset ${reset} session${reset !== 1 ? "s" : ""}`, {
        description: "High-usage sessions cleared. Compaction happens automatically during agent runs.",
      });
    }
    if (failed > 0) {
      toast.error(`Failed to reset ${failed} session${failed !== 1 ? "s" : ""}`, {
        description: "Check console for details.",
      });
    }
    setRunning(false);
    onRefresh?.();
  };

  const runPrune = async () => {
    if (!connected || staleCandidates.length === 0) return;
    setRunning(true);
    let pruned = 0;
    let failed = 0;
    for (const session of staleCandidates) {
      try {
        await request("sessions.delete", { key: session.key });
        pruned++;
      } catch (err) {
        console.error(`[Prune] Failed to delete session ${session.key}:`, err);
        failed++;
      }
    }
    if (pruned > 0) {
      toast.success(`Deleted ${pruned} stale session${pruned !== 1 ? "s" : ""}`);
    }
    if (failed > 0) {
      toast.error(`Failed to delete ${failed} session${failed !== 1 ? "s" : ""}`, {
        description: "Check console for details.",
      });
    }
    setRunning(false);
    onRefresh?.();
  };

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-zinc-400" />
              Compaction Policies
            </CardTitle>
            <CardDescription className="text-xs text-zinc-500 mt-0.5">
              Automated session maintenance rules
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing(!editing)}
            className="h-7 px-2 text-zinc-400 hover:text-zinc-200"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {editing ? (
          <div className="space-y-3">
            {/* Auto-compact settings */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Minimize2 className="w-3.5 h-3.5 text-zinc-400" />
                <Label className="text-xs text-zinc-300 font-medium">Auto-Compact</Label>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="50"
                  max="100"
                  value={draft.autoCompactThreshold}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      autoCompactThreshold: Math.min(
                        100,
                        Math.max(50, parseInt(e.target.value) || 90)
                      ),
                    })
                  }
                  className="h-8 w-20 bg-zinc-800 border-zinc-700 text-sm"
                />
                <span className="text-xs text-zinc-500">% capacity threshold</span>
                <Button
                  variant={draft.autoCompactEnabled ? "default" : "secondary"}
                  size="sm"
                  className={cn(
                    "h-7 text-xs ml-auto",
                    draft.autoCompactEnabled
                      ? "bg-emerald-600 hover:bg-emerald-500"
                      : "bg-zinc-800"
                  )}
                  onClick={() =>
                    setDraft({ ...draft, autoCompactEnabled: !draft.autoCompactEnabled })
                  }
                >
                  {draft.autoCompactEnabled ? "Enabled" : "Disabled"}
                </Button>
              </div>
            </div>

            {/* Stale session pruning */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                <Label className="text-xs text-zinc-300 font-medium">Stale Pruning</Label>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  max="168"
                  value={draft.staleSessionHours}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      staleSessionHours: Math.min(
                        168,
                        Math.max(1, parseInt(e.target.value) || 48)
                      ),
                    })
                  }
                  className="h-8 w-20 bg-zinc-800 border-zinc-700 text-sm"
                />
                <span className="text-xs text-zinc-500">hours inactive</span>
                <Button
                  variant={draft.stalePruneEnabled ? "default" : "secondary"}
                  size="sm"
                  className={cn(
                    "h-7 text-xs ml-auto",
                    draft.stalePruneEnabled
                      ? "bg-emerald-600 hover:bg-emerald-500"
                      : "bg-zinc-800"
                  )}
                  onClick={() =>
                    setDraft({ ...draft, stalePruneEnabled: !draft.stalePruneEnabled })
                  }
                >
                  {draft.stalePruneEnabled ? "Enabled" : "Disabled"}
                </Button>
              </div>
            </div>

            {/* Protected agents */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-zinc-400" />
                <Label className="text-xs text-zinc-300 font-medium">Protected Agents</Label>
              </div>
              <Input
                type="text"
                value={draft.protectedAgents.join(", ")}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    protectedAgents: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="main, dev, ops"
                className="h-8 bg-zinc-800 border-zinc-700 text-sm"
              />
              <p className="text-xs text-zinc-500">
                These agents will never be auto-pruned (comma-separated)
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleSave}
                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500"
              >
                Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                className="h-7 text-xs"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Auto-compact status */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700">
              <div className="flex items-center gap-2">
                <Minimize2 className="w-4 h-4 text-zinc-400" />
                <div>
                  <p className="text-sm text-zinc-200">High Usage Reset</p>
                  <p className="text-xs text-zinc-500">
                    {policy.autoCompactEnabled
                      ? `Reset sessions at ${policy.autoCompactThreshold}% capacity`
                      : "Manual only — compaction is automatic during agent runs"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {compactCandidates.length > 0 && (
                  <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50 text-xs">
                    {compactCandidates.length} eligible
                  </Badge>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs bg-zinc-700 hover:bg-zinc-600"
                  onClick={runCompaction}
                  disabled={running || !connected || compactCandidates.length === 0}
                >
                  <Zap className="w-3 h-3 mr-1" />
                  Run Now
                </Button>
              </div>
            </div>

            {/* Stale prune status */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-zinc-400" />
                <div>
                  <p className="text-sm text-zinc-200">Stale Cleanup</p>
                  <p className="text-xs text-zinc-500">
                    {policy.stalePruneEnabled
                      ? `Delete after ${policy.staleSessionHours}h inactive`
                      : "Manual only"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {staleCandidates.length > 0 && (
                  <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/50 text-xs">
                    {staleCandidates.length} stale
                  </Badge>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs bg-zinc-700 hover:bg-zinc-600"
                  onClick={runPrune}
                  disabled={running || !connected || staleCandidates.length === 0}
                >
                  <Zap className="w-3 h-3 mr-1" />
                  Run Now
                </Button>
              </div>
            </div>

            {/* Protected list */}
            {policy.protectedAgents.length > 0 && (
              <div className="flex items-center gap-2 px-1">
                <Shield className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-xs text-zinc-500">Protected:</span>
                {policy.protectedAgents.map((agent) => (
                  <Badge
                    key={agent}
                    variant="outline"
                    className="text-[10px] border-zinc-600 text-zinc-400"
                  >
                    {agent}
                  </Badge>
                ))}
              </div>
            )}

            {compactCandidates.length === 0 && staleCandidates.length === 0 && (
              <div className="flex items-center gap-2 text-xs text-emerald-400 px-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                All sessions healthy
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
