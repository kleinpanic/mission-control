"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw,
  Search,
  AlertCircle,
  AlertTriangle,
  Info,
  Bug,
  FileText,
  Clock,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  source?: string;
  details?: string;
}

interface FileActivity {
  path: string;
  operations: number;
  lastModified: string;
}

interface ErrorSummary {
  message: string;
  count: number;
  lastSeen: string;
  level: "error" | "warn";
}

const MOCK_LOGS: LogEntry[] = [
  { timestamp: new Date().toISOString(), level: "info", message: "Gateway connected", source: "gateway" },
  { timestamp: new Date(Date.now() - 60000).toISOString(), level: "warn", message: "Rate limit approaching", source: "api" },
  { timestamp: new Date(Date.now() - 120000).toISOString(), level: "error", message: "Failed to fetch sessions", source: "sessions", details: "ECONNREFUSED" },
  { timestamp: new Date(Date.now() - 180000).toISOString(), level: "debug", message: "WebSocket heartbeat", source: "ws" },
  { timestamp: new Date(Date.now() - 240000).toISOString(), level: "info", message: "Cron job executed: heartbeat-main", source: "cron" },
  { timestamp: new Date(Date.now() - 300000).toISOString(), level: "error", message: "Database connection timeout", source: "db", details: "ETIMEDOUT after 5000ms" },
  { timestamp: new Date(Date.now() - 360000).toISOString(), level: "info", message: "Task created: Test task", source: "tasks" },
  { timestamp: new Date(Date.now() - 420000).toISOString(), level: "warn", message: "High memory usage detected", source: "system" },
];

const LEVEL_CONFIG = {
  error: { icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/10 border-red-500/20" },
  warn: { icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-500/10 border-yellow-500/20" },
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/20" },
  debug: { icon: Bug, color: "text-zinc-500", bg: "bg-zinc-500/10 border-zinc-500/20" },
};

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatRelative(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AnalyticsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState<string | null>(null);

  useEffect(() => {
    // Simulate loading logs
    const timer = setTimeout(() => {
      setLogs(MOCK_LOGS);
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const refreshLogs = () => {
    setLoading(true);
    setTimeout(() => {
      setLogs(MOCK_LOGS);
      setLoading(false);
    }, 500);
  };

  const filteredLogs = logs.filter((log) => {
    if (levelFilter && log.level !== levelFilter) return false;
    if (filter && !log.message.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  const errorCount = logs.filter((l) => l.level === "error").length;
  const warnCount = logs.filter((l) => l.level === "warn").length;

  // Aggregate errors
  const errorSummary: ErrorSummary[] = logs
    .filter((l) => l.level === "error" || l.level === "warn")
    .reduce((acc, log) => {
      const existing = acc.find((e) => e.message === log.message);
      if (existing) {
        existing.count++;
        if (new Date(log.timestamp) > new Date(existing.lastSeen)) {
          existing.lastSeen = log.timestamp;
        }
      } else {
        acc.push({
          message: log.message,
          count: 1,
          lastSeen: log.timestamp,
          level: log.level as "error" | "warn",
        });
      }
      return acc;
    }, [] as ErrorSummary[])
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics & Debugging</h1>
          <p className="text-muted-foreground">View logs, errors, and system activity</p>
        </div>
        <Button variant="secondary" size="sm" onClick={refreshLogs} disabled={loading}>
          <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Logs</p>
                <p className="text-2xl font-bold">{logs.length}</p>
              </div>
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Errors</p>
                <p className="text-2xl font-bold text-red-500">{errorCount}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Warnings</p>
                <p className="text-2xl font-bold text-yellow-500">{warnCount}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Last Activity</p>
                <p className="text-lg font-medium">
                  {logs[0] ? formatRelative(logs[0].timestamp) : "—"}
                </p>
              </div>
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Error Aggregation */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Error Summary
            </CardTitle>
            <CardDescription>Aggregated errors and warnings</CardDescription>
          </CardHeader>
          <CardContent>
            {errorSummary.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No errors or warnings
              </p>
            ) : (
              <div className="space-y-3">
                {errorSummary.map((error, i) => (
                  <div
                    key={i}
                    className={cn(
                      "p-3 rounded-lg border",
                      error.level === "error"
                        ? "bg-red-500/10 border-red-500/20"
                        : "bg-yellow-500/10 border-yellow-500/20"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium line-clamp-2">{error.message}</p>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "shrink-0",
                          error.level === "error" ? "bg-red-500/20 text-red-500" : "bg-yellow-500/20 text-yellow-500"
                        )}
                      >
                        {error.count}x
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Last seen: {formatRelative(error.lastSeen)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Log Viewer */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Log Viewer
                </CardTitle>
                <CardDescription>Real-time application logs</CardDescription>
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Filter logs..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-1">
                {(["error", "warn", "info", "debug"] as const).map((level) => {
                  const config = LEVEL_CONFIG[level];
                  return (
                    <Button
                      key={level}
                      variant={levelFilter === level ? "default" : "outline"}
                      size="sm"
                      onClick={() => setLevelFilter(levelFilter === level ? null : level)}
                      className="px-2"
                    >
                      <config.icon className={cn("w-4 h-4", levelFilter !== level && config.color)} />
                    </Button>
                  );
                })}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : filteredLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No logs match your filter
              </p>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {filteredLogs.map((log, i) => {
                  const config = LEVEL_CONFIG[log.level];
                  const Icon = config.icon;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "p-3 rounded-lg border flex items-start gap-3",
                        config.bg
                      )}
                    >
                      <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", config.color)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{log.message}</span>
                          {log.source && (
                            <Badge variant="secondary" className="text-xs">
                              {log.source}
                            </Badge>
                          )}
                        </div>
                        {log.details && (
                          <p className="text-xs text-muted-foreground mt-1 font-mono">
                            {log.details}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatTime(log.timestamp)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Debug Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bug className="w-5 h-5" />
            Debug Information
          </CardTitle>
          <CardDescription>System state and configuration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground">Node.js</p>
              <p className="font-mono text-sm">v22.22.0</p>
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground">Next.js</p>
              <p className="font-mono text-sm">16.1.6</p>
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground">Gateway</p>
              <p className="font-mono text-sm">ws://127.0.0.1:18789</p>
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground">Uptime</p>
              <p className="font-mono text-sm">
                {Math.floor(Math.random() * 24)}h {Math.floor(Math.random() * 60)}m
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
