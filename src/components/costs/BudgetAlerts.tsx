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
  AlertTriangle,
  Bell,
  BellOff,
  Settings2,
  TrendingUp,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BudgetConfig {
  daily: number;
  weekly: number;
  monthly: number;
  alertThreshold: number; // percentage (0-100) at which to warn
  enabled: boolean;
}

interface BudgetAlertsProps {
  currentDaily: number;
  currentWeekly: number;
  currentMonthly: number;
}

const STORAGE_KEY = "mission-control-budget-config";

const DEFAULT_CONFIG: BudgetConfig = {
  daily: 5,
  weekly: 25,
  monthly: 80,
  alertThreshold: 80,
  enabled: true,
};

function loadConfig(): BudgetConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch {
    // ignore parse errors
  }
  return DEFAULT_CONFIG;
}

function saveConfig(config: BudgetConfig) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

type AlertLevel = "ok" | "warning" | "danger" | "exceeded";

function getAlertLevel(
  current: number,
  budget: number,
  threshold: number
): AlertLevel {
  if (budget <= 0) return "ok";
  const pct = (current / budget) * 100;
  if (pct >= 100) return "exceeded";
  if (pct >= threshold) return "danger";
  if (pct >= threshold * 0.75) return "warning";
  return "ok";
}

function AlertBadge({ level }: { level: AlertLevel }) {
  switch (level) {
    case "exceeded":
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/50">
          <XCircle className="w-3 h-3 mr-1" />
          Over Budget
        </Badge>
      );
    case "danger":
      return (
        <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/50">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Near Limit
        </Badge>
      );
    case "warning":
      return (
        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">
          <TrendingUp className="w-3 h-3 mr-1" />
          Approaching
        </Badge>
      );
    case "ok":
      return (
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          On Track
        </Badge>
      );
  }
}

function ProgressBar({
  current,
  budget,
  level,
}: {
  current: number;
  budget: number;
  level: AlertLevel;
}) {
  const pct = budget > 0 ? Math.min((current / budget) * 100, 100) : 0;
  const overPct =
    budget > 0 && current > budget
      ? Math.min(((current - budget) / budget) * 100, 50)
      : 0;

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-zinc-400 mb-1">
        <span>${current.toFixed(2)}</span>
        <span>${budget.toFixed(2)}</span>
      </div>
      <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden relative">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            level === "exceeded"
              ? "bg-red-500"
              : level === "danger"
                ? "bg-orange-500"
                : level === "warning"
                  ? "bg-yellow-500"
                  : "bg-emerald-500"
          )}
          style={{ width: `${pct}%` }}
        />
        {overPct > 0 && (
          <div
            className="absolute top-0 right-0 h-full bg-red-500/40 animate-pulse rounded-r-full"
            style={{ width: `${overPct}%` }}
          />
        )}
      </div>
      <div className="text-right text-xs text-zinc-500 mt-0.5">
        {pct.toFixed(0)}% used
      </div>
    </div>
  );
}

export function BudgetAlerts({
  currentDaily,
  currentWeekly,
  currentMonthly,
}: BudgetAlertsProps) {
  const [config, setConfig] = useState<BudgetConfig>(DEFAULT_CONFIG);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<BudgetConfig>(DEFAULT_CONFIG);

  // Load config from localStorage on mount
  useEffect(() => {
    const loaded = loadConfig();
    setConfig(loaded);
    setDraft(loaded);
  }, []);

  const handleSave = useCallback(() => {
    saveConfig(draft);
    setConfig(draft);
    setEditing(false);
  }, [draft]);

  const handleCancel = useCallback(() => {
    setDraft(config);
    setEditing(false);
  }, [config]);

  const handleToggle = useCallback(() => {
    const updated = { ...config, enabled: !config.enabled };
    saveConfig(updated);
    setConfig(updated);
    setDraft(updated);
  }, [config]);

  const dailyLevel = getAlertLevel(
    currentDaily,
    config.daily,
    config.alertThreshold
  );
  const weeklyLevel = getAlertLevel(
    currentWeekly,
    config.weekly,
    config.alertThreshold
  );
  const monthlyLevel = getAlertLevel(
    currentMonthly,
    config.monthly,
    config.alertThreshold
  );

  const worstLevel: AlertLevel = [dailyLevel, weeklyLevel, monthlyLevel].includes("exceeded")
    ? "exceeded"
    : [dailyLevel, weeklyLevel, monthlyLevel].includes("danger")
      ? "danger"
      : [dailyLevel, weeklyLevel, monthlyLevel].includes("warning")
        ? "warning"
        : "ok";

  return (
    <Card
      className={cn(
        "border transition-colors duration-300",
        !config.enabled
          ? "bg-zinc-900 border-zinc-800"
          : worstLevel === "exceeded"
            ? "bg-red-950/30 border-red-800/50"
            : worstLevel === "danger"
              ? "bg-orange-950/20 border-orange-800/40"
              : worstLevel === "warning"
                ? "bg-yellow-950/20 border-yellow-800/30"
                : "bg-zinc-900 border-zinc-800"
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              {config.enabled ? (
                <Bell className="w-4 h-4 text-zinc-400" />
              ) : (
                <BellOff className="w-4 h-4 text-zinc-600" />
              )}
              Budget Alerts
            </CardTitle>
            {config.enabled && <AlertBadge level={worstLevel} />}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggle}
              className="h-7 px-2 text-xs text-zinc-400 hover:text-zinc-200"
            >
              {config.enabled ? "Disable" : "Enable"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing(!editing)}
              className="h-7 px-2 text-zinc-400 hover:text-zinc-200"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        {!config.enabled && (
          <CardDescription className="text-zinc-500 text-xs">
            Budget monitoring is disabled
          </CardDescription>
        )}
      </CardHeader>

      {config.enabled && (
        <CardContent className="space-y-4">
          {editing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-zinc-400">
                    Daily Budget ($)
                  </Label>
                  <Input
                    type="number"
                    step="0.50"
                    min="0"
                    value={draft.daily}
                    onChange={(e) =>
                      setDraft({ ...draft, daily: parseFloat(e.target.value) || 0 })
                    }
                    className="h-8 bg-zinc-800 border-zinc-700 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-zinc-400">
                    Weekly Budget ($)
                  </Label>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={draft.weekly}
                    onChange={(e) =>
                      setDraft({ ...draft, weekly: parseFloat(e.target.value) || 0 })
                    }
                    className="h-8 bg-zinc-800 border-zinc-700 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-zinc-400">
                    Monthly Budget ($)
                  </Label>
                  <Input
                    type="number"
                    step="5"
                    min="0"
                    value={draft.monthly}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        monthly: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="h-8 bg-zinc-800 border-zinc-700 text-sm"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-zinc-400">
                  Alert Threshold (% of budget)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="50"
                    max="100"
                    value={draft.alertThreshold}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        alertThreshold:
                          Math.min(100, Math.max(50, parseInt(e.target.value) || 80)),
                      })
                    }
                    className="h-8 w-20 bg-zinc-800 border-zinc-700 text-sm"
                  />
                  <span className="text-xs text-zinc-500">
                    Alert when spending exceeds {draft.alertThreshold}% of budget
                  </span>
                </div>
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
              {/* Daily */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-300">
                    Daily
                  </span>
                  <AlertBadge level={dailyLevel} />
                </div>
                <ProgressBar
                  current={currentDaily}
                  budget={config.daily}
                  level={dailyLevel}
                />
              </div>

              {/* Weekly */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-300">
                    Weekly
                  </span>
                  <AlertBadge level={weeklyLevel} />
                </div>
                <ProgressBar
                  current={currentWeekly}
                  budget={config.weekly}
                  level={weeklyLevel}
                />
              </div>

              {/* Monthly */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-300">
                    Monthly
                  </span>
                  <AlertBadge level={monthlyLevel} />
                </div>
                <ProgressBar
                  current={currentMonthly}
                  budget={config.monthly}
                  level={monthlyLevel}
                />
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
