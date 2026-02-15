"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  Server,
  Database,
  Cpu,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LogEntry {
  timestamp: string;
  level: 'error' | 'warning' | 'info' | 'debug';
  message: string;
  file?: string;
  line?: number;
}

interface FileActivity {
  file: string;
  touchCount: number;
  lastTouched: string;
  operations: string[];
}

interface DebugInfo {
  system: {
    platform: string;
    arch: string;
    hostname: string;
    uptime: number;
    memory: {
      total: number;
      free: number;
      used: number;
    };
    cpu: {
      model: string;
      cores: number;
    };
  };
  gateway: {
    status: 'running' | 'stopped' | 'unknown';
    url: string;
    version?: string;
  };
  openclaw: {
    configPath: string;
    logsPath: string;
    workspacePath: string;
  };
  node: {
    version: string;
  };
}

export default function AnalyticsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [_auditLogs, setAuditLogs] = useState<LogEntry[]>([]);
  const [fileActivity, setFileActivity] = useState<FileActivity[]>([]);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Extract unique agents from logs
  const uniqueAgents = Array.from(
    new Set(
      logs
        .map((log: any) => log.agent || log.agentId)
        .filter(Boolean)
    )
  ).sort();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [logsRes, auditRes, activityRes, debugRes] = await Promise.all([
        fetch('/api/logs?source=openclaw&limit=200'),
        fetch('/api/logs?source=audit&limit=200'),
        fetch('/api/file-activity'),
        fetch('/api/debug'),
      ]);

      const [logsData, auditData, activityData, debugData] = await Promise.all([
        logsRes.json(),
        auditRes.json(),
        activityRes.json(),
        debugRes.json(),
      ]);

      setLogs(logsData.entries || []);
      setAuditLogs(auditData.entries || []);
      setFileActivity(activityData.activities || []);
      setDebugInfo(debugData);
    } catch (error) {
      console.error('Failed to fetch analytics data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  let filteredLogs = logs;
  
  // Apply level filter
  if (levelFilter) {
    filteredLogs = filteredLogs.filter(log => log.level === levelFilter);
  }
  
  // Apply agent filter
  if (agentFilter) {
    filteredLogs = filteredLogs.filter((log: any) => 
      (log.agent === agentFilter || log.agentId === agentFilter)
    );
  }

  const errorCount = logs.filter(log => log.level === 'error').length;
  const warningCount = logs.filter(log => log.level === 'warning').length;
  const infoCount = logs.filter(log => log.level === 'info').length;

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 ** 3);
    return `${gb.toFixed(2)} GB`;
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${mins}m`;
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error': return <AlertCircle className="w-4 h-4" />;
      case 'warning': return <AlertTriangle className="w-4 h-4" />;
      case 'info': return <Info className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-500 bg-red-500/10 border-red-500/50';
      case 'warning': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/50';
      case 'info': return 'text-blue-500 bg-blue-500/10 border-blue-500/50';
      default: return 'text-gray-500 bg-gray-500/10 border-gray-500/50';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Analytics & Debugging</h1>
        <Button
          onClick={fetchData}
          disabled={loading}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Error Aggregation Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Errors</p>
                <p className="text-2xl font-bold text-red-500">{errorCount}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Warnings</p>
                <p className="text-2xl font-bold text-yellow-500">{warningCount}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Info</p>
                <p className="text-2xl font-bold text-blue-500">{infoCount}</p>
              </div>
              <Info className="w-8 h-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="logs" className="w-full">
        <TabsList>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="files">File Activity</TabsTrigger>
          <TabsTrigger value="debug">Debug Info</TabsTrigger>
        </TabsList>

        {/* Log Viewer */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Log Viewer</CardTitle>
                  <CardDescription>System logs with error highlighting</CardDescription>
                </div>
                <div className="space-y-2">
                  {/* Level Filters */}
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground self-center mr-2">Level:</span>
                    <Button
                      variant={levelFilter === null ? "default" : "outline"}
                      size="sm"
                      onClick={() => setLevelFilter(null)}
                    >
                      All
                    </Button>
                    <Button
                      variant={levelFilter === 'error' ? "default" : "outline"}
                      size="sm"
                      onClick={() => setLevelFilter('error')}
                    >
                      Errors
                    </Button>
                    <Button
                      variant={levelFilter === 'warning' ? "default" : "outline"}
                      size="sm"
                      onClick={() => setLevelFilter('warning')}
                    >
                      Warnings
                    </Button>
                    <Button
                      variant={levelFilter === 'info' ? "default" : "outline"}
                      size="sm"
                      onClick={() => setLevelFilter('info')}
                    >
                      Info
                    </Button>
                  </div>
                  
                  {/* Agent Filters (NEW) */}
                  {uniqueAgents.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground self-center mr-2">Agent:</span>
                      <Button
                        variant={agentFilter === null ? "default" : "outline"}
                        size="sm"
                        onClick={() => setAgentFilter(null)}
                      >
                        All
                      </Button>
                      {uniqueAgents.map((agent) => (
                        <Button
                          key={agent}
                          variant={agentFilter === agent ? "default" : "outline"}
                          size="sm"
                          onClick={() => setAgentFilter(agent as string)}
                        >
                          {agent}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredLogs.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No logs found
                  </p>
                )}
                {filteredLogs.slice().reverse().map((log, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "p-3 rounded-lg border font-mono text-xs",
                      getLevelColor(log.level)
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {getLevelIcon(log.level)}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            {log.level.toUpperCase()}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                          {log.file && (
                            <span className="text-[10px] text-muted-foreground">
                              {log.file}
                              {log.line && `:${log.line}`}
                            </span>
                          )}
                        </div>
                        <p className="break-all">{log.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* File Activity */}
        <TabsContent value="files" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">File Activity</CardTitle>
              <CardDescription>Most frequently accessed files</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {fileActivity.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No file activity found
                  </p>
                )}
                {fileActivity.map((activity, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <code className="text-sm font-mono">{activity.file}</code>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>Touches: {activity.touchCount}</span>
                          <span>•</span>
                          <span>Last: {new Date(activity.lastTouched).toLocaleString()}</span>
                          {activity.operations.length > 0 && (
                            <>
                              <span>•</span>
                              <span>Ops: {activity.operations.join(', ')}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Debug Info */}
        <TabsContent value="debug" className="space-y-4">
          {debugInfo && (
            <>
              {/* Gateway Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Server className="w-5 h-5" />
                    Gateway Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge
                      className={cn(
                        debugInfo.gateway.status === 'running'
                          ? 'bg-green-500/20 text-green-400 border-green-500/50'
                          : 'bg-red-500/20 text-red-400 border-red-500/50'
                      )}
                    >
                      {debugInfo.gateway.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">URL</span>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {debugInfo.gateway.url}
                    </code>
                  </div>
                  {debugInfo.gateway.version && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Version</span>
                      <span className="text-sm">{debugInfo.gateway.version}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* System Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Cpu className="w-5 h-5" />
                    System Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Platform</span>
                    <span className="text-sm">
                      {debugInfo.system.platform} ({debugInfo.system.arch})
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Hostname</span>
                    <span className="text-sm">{debugInfo.system.hostname}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Uptime</span>
                    <span className="text-sm">{formatUptime(debugInfo.system.uptime)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">CPU</span>
                    <span className="text-sm">
                      {debugInfo.system.cpu.cores} cores
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Memory</span>
                    <span className="text-sm">
                      {formatBytes(debugInfo.system.memory.used)} / {formatBytes(debugInfo.system.memory.total)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Node.js</span>
                    <span className="text-sm">{debugInfo.node.version}</span>
                  </div>
                </CardContent>
              </Card>

              {/* OpenClaw Paths */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    OpenClaw Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Config</p>
                    <code className="text-xs bg-muted px-2 py-1 rounded block break-all">
                      {debugInfo.openclaw.configPath}
                    </code>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Logs</p>
                    <code className="text-xs bg-muted px-2 py-1 rounded block break-all">
                      {debugInfo.openclaw.logsPath}
                    </code>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Workspace</p>
                    <code className="text-xs bg-muted px-2 py-1 rounded block break-all">
                      {debugInfo.openclaw.workspacePath}
                    </code>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
