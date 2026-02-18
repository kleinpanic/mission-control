"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InfoTip } from "@/components/ui/info-tip";
import {
  FileText, AlertCircle, AlertTriangle, Info, Server, Database, Cpu,
  RefreshCw, HardDrive, Globe, MemoryStick, Clock, Wifi, Bot, Activity,
  ChevronRight, Copy, CheckCircle, Terminal, Disc, Network,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LogEntry {
  timestamp: string;
  level: "error" | "warning" | "info" | "debug";
  message: string;
  file?: string;
  line?: number;
  agent?: string;
  agentId?: string;
}

interface FileActivity {
  file: string;
  touchCount: number;
  lastTouched: string;
  operations: string[];
}

interface DebugInfo {
  system: {
    platform: string; arch: string; hostname: string; uptime: number;
    memory: { total: number; free: number; used: number };
    cpu: { model: string; cores: number };
    disk?: { total: string; used: string; available: string; percentUsed: string };
    loadAvg?: number[];
  };
  gateway: { status: "running" | "stopped" | "unknown"; url: string; version?: string; pid?: number };
  openclaw: {
    configPath: string; logsPath: string; workspacePath: string;
    configSummary?: { agents?: number; channels?: string[]; modelOverrides?: number };
  };
  node: { version: string; npmVersion?: string };
  recentErrors?: { timestamp: string; message: string }[];
  services?: { name: string; status: string }[];
}

export default function AnalyticsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [fileActivity, setFileActivity] = useState<FileActivity[]>([]);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [sessionFileActivity, setSessionFileActivity] = useState<any[]>([]);
  const [agentLogs, setAgentLogs] = useState<any[]>([]);
  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const uniqueAgents = Array.from(
    new Set(logs.map((log) => log.agent || log.agentId).filter(Boolean))
  ).sort();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [logsRes, activityRes, debugRes, statusRes, agentLogsRes] = await Promise.all([
        fetch("/api/logs?source=openclaw&limit=200"),
        fetch("/api/file-activity"),
        fetch("/api/debug"),
        fetch("/api/status"),
        fetch("/api/logs/agents?limit=30"),
      ]);

      const [logsData, activityData, debugData, statusData, agentLogsData] = await Promise.all([
        logsRes.ok ? logsRes.json() : { entries: [] },
        activityRes.ok ? activityRes.json() : { activities: [] },
        debugRes.ok ? debugRes.json() : null,
        statusRes.ok ? statusRes.json() : null,
        agentLogsRes.ok ? agentLogsRes.json() : { agents: [] },
      ]);

      setLogs(logsData.entries || []);
      setFileActivity(activityData.activities || []);
      setDebugInfo(debugData);
      setAgentLogs(agentLogsData.agents || []);

      // Build file activity from session data as fallback
      if ((activityData.activities || []).length === 0 && statusData?.sessions?.byAgent) {
        const byAgent = statusData.sessions.byAgent;
        const sessionActivity = byAgent.map((ba: any) => ({
          agent: ba.agentId,
          sessions: ba.count || ba.recent?.length || 0,
          totalTokens: (ba.recent || []).reduce((s: number, r: any) => s + (r.totalTokens || 0), 0),
          maxContext: Math.max(...(ba.recent || []).map((r: any) => r.percentUsed || 0), 0),
          lastActive: ba.recent?.[0]?.age != null
            ? ba.recent[0].age < 60000 ? "Just now"
            : ba.recent[0].age < 3600000 ? `${Math.floor(ba.recent[0].age / 60000)}m ago`
            : `${Math.floor(ba.recent[0].age / 3600000)}h ago`
            : "—",
        })).sort((a: any, b: any) => b.totalTokens - a.totalTokens);
        setSessionFileActivity(sessionActivity);
      }
    } catch (error) {
      console.error("Failed to fetch analytics data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  let filteredLogs = logs;
  if (levelFilter) filteredLogs = filteredLogs.filter((log) => log.level === levelFilter);
  if (agentFilter) filteredLogs = filteredLogs.filter((log) => (log.agent === agentFilter || log.agentId === agentFilter));

  const errorCount = logs.filter((log) => log.level === "error").length;
  const warningCount = logs.filter((log) => log.level === "warning").length;
  const infoCount = logs.filter((log) => log.level === "info").length;

  const formatBytes = (bytes: number) => `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${mins}m`;
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "error": return <AlertCircle className="w-4 h-4" />;
      case "warning": return <AlertTriangle className="w-4 h-4" />;
      case "info": return <Info className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "error": return "text-red-400 bg-red-500/10 border-red-500/30";
      case "warning": return "text-amber-400 bg-amber-500/10 border-amber-500/30";
      case "info": return "text-blue-400 bg-blue-500/10 border-blue-500/30";
      default: return "text-zinc-400 bg-zinc-500/10 border-zinc-500/30";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-zinc-100">Analytics & Debugging</h1>
          <InfoTip content="System diagnostics, log viewer, and debug info. Logs are sourced from OpenClaw's runtime log files. File activity tracks workspace file operations." />
        </div>
        <Button onClick={fetchData} disabled={loading} variant="secondary" size="sm" className="bg-zinc-800 hover:bg-zinc-700">
          <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-400">Errors</p>
                <p className={cn("text-2xl font-bold", errorCount > 0 ? "text-red-400" : "text-zinc-500")}>{errorCount}</p>
              </div>
              <AlertCircle className={cn("w-8 h-8", errorCount > 0 ? "text-red-400/50" : "text-zinc-700")} />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-400">Warnings</p>
                <p className={cn("text-2xl font-bold", warningCount > 0 ? "text-amber-400" : "text-zinc-500")}>{warningCount}</p>
              </div>
              <AlertTriangle className={cn("w-8 h-8", warningCount > 0 ? "text-amber-400/50" : "text-zinc-700")} />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-400">Info</p>
                <p className="text-2xl font-bold text-blue-400">{infoCount}</p>
              </div>
              <Info className="w-8 h-8 text-blue-400/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="logs" className="w-full">
        <TabsList className="bg-zinc-800">
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="files">File Activity</TabsTrigger>
          <TabsTrigger value="debug">Debug Info</TabsTrigger>
        </TabsList>

        {/* Log Viewer */}
        <TabsContent value="logs" className="space-y-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="text-lg text-zinc-100">Log Viewer</CardTitle>
                  <CardDescription className="text-zinc-400">System logs with level filtering</CardDescription>
                </div>
                <div className="space-y-2">
                  <div className="flex gap-1.5 flex-wrap">
                    <span className="text-xs text-zinc-500 self-center mr-1">Level:</span>
                    {[null, "error", "warning", "info"].map((f) => (
                      <Button key={f || "all"} variant={levelFilter === f ? "default" : "outline"} size="sm"
                        className={cn("h-7 text-xs", levelFilter === f ? "bg-emerald-600 hover:bg-emerald-500" : "border-zinc-700 text-zinc-400")}
                        onClick={() => setLevelFilter(f)}
                      >
                        {f === null ? "All" : f === "error" ? "Errors" : f === "warning" ? "Warnings" : "Info"}
                      </Button>
                    ))}
                  </div>
                  {uniqueAgents.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      <span className="text-xs text-zinc-500 self-center mr-1">Agent:</span>
                      <Button variant={agentFilter === null ? "default" : "outline"} size="sm"
                        className={cn("h-7 text-xs", agentFilter === null ? "bg-emerald-600" : "border-zinc-700 text-zinc-400")}
                        onClick={() => setAgentFilter(null)}
                      >All</Button>
                      {uniqueAgents.map((agent) => (
                        <Button key={agent} variant={agentFilter === agent ? "default" : "outline"} size="sm"
                          className={cn("h-7 text-xs", agentFilter === agent ? "bg-emerald-600" : "border-zinc-700 text-zinc-400")}
                          onClick={() => setAgentFilter(agent as string)}
                        >{agent}</Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
                {filteredLogs.length === 0 && (
                  <p className="text-sm text-zinc-500 text-center py-8">No logs found</p>
                )}
                {filteredLogs.slice().reverse().map((log, idx) => (
                  <div key={idx} className={cn("p-2.5 rounded-lg border font-mono text-xs", getLevelColor(log.level))}>
                    <div className="flex items-start gap-2">
                      {getLevelIcon(log.level)}
                      <div className="flex-1 space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[9px]">{log.level.toUpperCase()}</Badge>
                          <span className="text-[10px] text-zinc-500">{new Date(log.timestamp).toLocaleString()}</span>
                          {(log.agent || log.agentId) && (
                            <Badge className="text-[9px] bg-purple-500/20 text-purple-400 border-purple-500/30">{log.agent || log.agentId}</Badge>
                          )}
                          {log.file && <span className="text-[10px] text-zinc-500">{log.file}{log.line && `:${log.line}`}</span>}
                        </div>
                        <p className="break-all text-zinc-300">{log.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* File Activity — Redesigned with per-agent scrollable cards */}
        <TabsContent value="files" className="space-y-4">
          {/* Recent Activity — horizontally scrollable agent cards */}
          {(agentLogs.length > 0 || sessionFileActivity.length > 0) && (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-400" />Recent Activity
                  </CardTitle>
                  <InfoTip content="Per-agent activity logs from demuxed log files. Each card shows one agent's recent log entries, scrollable vertically. Scroll horizontally to see all agents." />
                </div>
                <CardDescription className="text-zinc-400">
                  {agentLogs.length > 0 ? `${agentLogs.length} agents with log data` : `${sessionFileActivity.length} active agents`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 overflow-x-auto pb-3 -mx-1 px-1" style={{ scrollSnapType: "x mandatory" }}>
                  {agentLogs.length > 0 ? (
                    agentLogs.map((agent: any) => (
                      <div
                        key={agent.agentId}
                        className="flex-shrink-0 w-[340px] bg-zinc-800/60 rounded-xl border border-zinc-700/50 overflow-hidden"
                        style={{ scrollSnapAlign: "start" }}
                      >
                        {/* Agent card header */}
                        <div className="p-3 border-b border-zinc-700/50 bg-zinc-800/80">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Bot className="w-4 h-4 text-purple-400" />
                              <span className="text-sm font-semibold text-zinc-200">{agent.agentId}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[9px] h-5 border-zinc-600 text-zinc-400">
                                {agent.entryCount} entries
                              </Badge>
                              {agent.lastActivity && (
                                <span className="text-[10px] text-zinc-500">
                                  {(() => {
                                    const diff = Date.now() - new Date(agent.lastActivity).getTime();
                                    if (diff < 60000) return "Just now";
                                    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
                                    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
                                    return `${Math.floor(diff / 86400000)}d ago`;
                                  })()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {/* Scrollable log entries */}
                        <div className="max-h-[400px] overflow-y-auto p-2 space-y-1">
                          {agent.recentEntries.length > 0 ? (
                            agent.recentEntries.map((entry: any, idx: number) => (
                              <div key={idx} className={cn(
                                "p-2 rounded-lg text-[11px] font-mono border",
                                entry.level === "error" ? "bg-red-500/5 border-red-500/20 text-red-300" :
                                entry.level === "warning" ? "bg-amber-500/5 border-amber-500/20 text-amber-300" :
                                "bg-zinc-800/30 border-zinc-700/30 text-zinc-400"
                              )}>
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  {entry.level === "error" ? <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" /> :
                                   entry.level === "warning" ? <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" /> :
                                   <ChevronRight className="w-3 h-3 text-zinc-500 flex-shrink-0" />}
                                  {entry.timestamp && (
                                    <span className="text-[9px] text-zinc-600">
                                      {new Date(entry.timestamp).toLocaleTimeString()}
                                    </span>
                                  )}
                                </div>
                                <p className="break-all leading-relaxed">{entry.message || JSON.stringify(entry).slice(0, 200)}</p>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-zinc-600 text-center py-4">No recent entries</p>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    sessionFileActivity.map((sa: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex-shrink-0 w-[340px] bg-zinc-800/60 rounded-xl border border-zinc-700/50 p-4"
                        style={{ scrollSnapAlign: "start" }}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className={cn(
                            "w-2.5 h-2.5 rounded-full",
                            sa.lastActive === "Just now" ? "bg-emerald-400" : "bg-zinc-600"
                          )} />
                          <div>
                            <span className="text-sm font-semibold text-zinc-200">{sa.agent}</span>
                            <p className="text-xs text-zinc-500">{sa.sessions} sessions • {sa.lastActive}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <div>
                            <p className="text-zinc-400">{sa.totalTokens > 1000000 ? `${(sa.totalTokens / 1000000).toFixed(1)}M` : sa.totalTokens > 1000 ? `${Math.floor(sa.totalTokens / 1000)}k` : sa.totalTokens} tokens</p>
                            <div className="flex items-center gap-1 mt-1">
                              <div className="w-20 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                                <div className={cn("h-full rounded-full", sa.maxContext > 80 ? "bg-red-500" : sa.maxContext > 50 ? "bg-amber-500" : "bg-emerald-500")}
                                  style={{ width: `${Math.min(sa.maxContext, 100)}%` }} />
                              </div>
                              <span className="text-zinc-500">{sa.maxContext}% ctx</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Original file activity list (preserved) */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg text-zinc-100">File Tracking</CardTitle>
                <InfoTip content="File access tracking from agent workspace operations via audit trail." />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {fileActivity.length > 0 ? (
                  fileActivity.map((activity, idx) => (
                    <div key={idx} className="p-3 rounded-lg border border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-zinc-400" />
                            <code className="text-sm font-mono text-zinc-200">{activity.file}</code>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-zinc-500">
                            <span>Touches: {activity.touchCount}</span>
                            <span>•</span>
                            <span>Last: {new Date(activity.lastTouched).toLocaleString()}</span>
                            {activity.operations.length > 0 && (
                              <><span>•</span><span>Ops: {activity.operations.join(", ")}</span></>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 space-y-2">
                    <FileText className="w-6 h-6 text-zinc-600 mx-auto" />
                    <p className="text-sm text-zinc-500">No file tracking data available</p>
                    <p className="text-xs text-zinc-600">File tracking populates when agents perform workspace operations</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Debug Info — IMPROVED */}
        <TabsContent value="debug" className="space-y-4">
          {debugInfo ? (
            <>
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
                      <Wifi className="w-5 h-5 text-emerald-400" />Gateway Status
                    </CardTitle>
                    <InfoTip content="OpenClaw gateway WebSocket server. Handles real-time communication between the dashboard and agents." />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-400">Status</span>
                    <Badge className={cn(
                      debugInfo.gateway.status === "running"
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        : "bg-red-500/20 text-red-400 border-red-500/30"
                    )}>{debugInfo.gateway.status}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-400">URL</span>
                    <code className="text-xs bg-zinc-800 px-2 py-1 rounded text-emerald-400 border border-zinc-700">{debugInfo.gateway.url}</code>
                  </div>
                  {debugInfo.gateway.version && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-400">Version</span>
                      <Badge variant="outline" className="text-zinc-300 border-zinc-600">{debugInfo.gateway.version}</Badge>
                    </div>
                  )}
                  {debugInfo.gateway.pid && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-400">PID</span>
                      <span className="text-sm text-zinc-200 font-mono">{debugInfo.gateway.pid}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-blue-400" />System
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-400 flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" />Platform</span>
                        <Badge variant="outline" className="text-zinc-300 border-zinc-600 font-mono text-xs">{debugInfo.system.platform} ({debugInfo.system.arch})</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-400 flex items-center gap-1.5"><Server className="w-3.5 h-3.5" />Hostname</span>
                        <span className="text-sm text-zinc-200 font-mono">{debugInfo.system.hostname}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-400 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Uptime</span>
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">{formatUptime(debugInfo.system.uptime)}</Badge>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-400 flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5" />CPU</span>
                        <span className="text-sm text-zinc-200">{debugInfo.system.cpu.cores} cores</span>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-zinc-400 flex items-center gap-1.5"><MemoryStick className="w-3.5 h-3.5" />Memory</span>
                          <span className="text-sm text-zinc-200">{formatBytes(debugInfo.system.memory.used)} / {formatBytes(debugInfo.system.memory.total)}</span>
                        </div>
                        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full",
                              (debugInfo.system.memory.used / debugInfo.system.memory.total) > 0.9 ? "bg-red-500"
                              : (debugInfo.system.memory.used / debugInfo.system.memory.total) > 0.7 ? "bg-amber-500"
                              : "bg-emerald-500"
                            )}
                            style={{ width: `${(debugInfo.system.memory.used / debugInfo.system.memory.total) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-400 flex items-center gap-1.5"><HardDrive className="w-3.5 h-3.5" />Node.js</span>
                        <Badge variant="outline" className="text-zinc-300 border-zinc-600 text-xs">{debugInfo.node.version}</Badge>
                      </div>
                      {debugInfo.node.npmVersion && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-zinc-400 flex items-center gap-1.5"><Terminal className="w-3.5 h-3.5" />npm</span>
                          <Badge variant="outline" className="text-zinc-300 border-zinc-600 text-xs">v{debugInfo.node.npmVersion}</Badge>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Disk Usage & Load */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-zinc-800">
                    {debugInfo.system.disk && (
                      <div className="space-y-2">
                        <span className="text-sm text-zinc-400 flex items-center gap-1.5"><Disc className="w-3.5 h-3.5" />Disk Usage</span>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full",
                                parseInt(debugInfo.system.disk.percentUsed) > 90 ? "bg-red-500"
                                : parseInt(debugInfo.system.disk.percentUsed) > 70 ? "bg-amber-500"
                                : "bg-emerald-500"
                              )}
                              style={{ width: debugInfo.system.disk.percentUsed }}
                            />
                          </div>
                          <span className="text-xs text-zinc-400">{debugInfo.system.disk.percentUsed}</span>
                        </div>
                        <p className="text-xs text-zinc-500">
                          {debugInfo.system.disk.used} used of {debugInfo.system.disk.total} ({debugInfo.system.disk.available} free)
                        </p>
                      </div>
                    )}
                    {debugInfo.system.loadAvg && (
                      <div className="space-y-2">
                        <span className="text-sm text-zinc-400 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" />Load Average</span>
                        <div className="flex gap-3">
                          {["1m", "5m", "15m"].map((label, i) => (
                            <div key={label} className="bg-zinc-800/50 rounded-lg px-3 py-1.5 border border-zinc-700/50">
                              <p className="text-[10px] text-zinc-500">{label}</p>
                              <p className={cn("text-sm font-mono",
                                (debugInfo.system.loadAvg?.[i] ?? 0) > debugInfo.system.cpu.cores ? "text-red-400" : "text-zinc-200"
                              )}>{debugInfo.system.loadAvg?.[i]?.toFixed(2)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Config Summary */}
              {debugInfo.openclaw.configSummary && (
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
                      <Network className="w-5 h-5 text-cyan-400" />Configuration Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50 text-center">
                        <p className="text-2xl font-bold text-zinc-100">{debugInfo.openclaw.configSummary.agents ?? 0}</p>
                        <p className="text-xs text-zinc-500">Agents</p>
                      </div>
                      <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50 text-center">
                        <p className="text-2xl font-bold text-zinc-100">{debugInfo.openclaw.configSummary.channels?.length ?? 0}</p>
                        <p className="text-xs text-zinc-500">Channels</p>
                        {debugInfo.openclaw.configSummary.channels && debugInfo.openclaw.configSummary.channels.length > 0 && (
                          <div className="flex gap-1 mt-1 justify-center flex-wrap">
                            {debugInfo.openclaw.configSummary.channels.map(ch => (
                              <Badge key={ch} variant="outline" className="text-[9px] h-4 px-1.5 border-zinc-600 text-zinc-400">{ch}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50 text-center">
                        <p className="text-2xl font-bold text-zinc-100">{debugInfo.openclaw.configSummary.modelOverrides ?? 0}</p>
                        <p className="text-xs text-zinc-500">Model Overrides</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recent Errors */}
              {debugInfo.recentErrors && debugInfo.recentErrors.length > 0 && (
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-red-400" />Recent Errors
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">{debugInfo.recentErrors.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                      {debugInfo.recentErrors.map((err, idx) => (
                        <div key={idx} className="p-2 rounded-lg bg-red-500/5 border border-red-500/20 text-xs font-mono">
                          {err.timestamp && (
                            <span className="text-red-400/60 mr-2">{new Date(err.timestamp).toLocaleString()}</span>
                          )}
                          <span className="text-red-300">{err.message}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
                    <Database className="w-5 h-5 text-purple-400" />OpenClaw Paths
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: "Config", path: debugInfo.openclaw.configPath },
                    { label: "Logs", path: debugInfo.openclaw.logsPath },
                    { label: "Workspace", path: debugInfo.openclaw.workspacePath },
                  ].map(({ label, path: pathVal }) => (
                    <div key={label}>
                      <p className="text-xs font-medium text-zinc-400 mb-1">{label}</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-zinc-800 px-3 py-1.5 rounded flex-1 break-all text-zinc-300 border border-zinc-700 font-mono">{pathVal}</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-300"
                          onClick={() => {
                            navigator.clipboard.writeText(pathVal);
                            setCopiedPath(pathVal);
                            setTimeout(() => setCopiedPath(null), 2000);
                          }}
                        >
                          {copiedPath === pathVal ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="pt-8 pb-8 text-center">
                <p className="text-zinc-500">Loading debug information...</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
