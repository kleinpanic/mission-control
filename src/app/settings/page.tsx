"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Server, Database, Moon, Sun, Monitor, Bot, Cpu, RefreshCw, Save, Lock, Eye, EyeOff, ChevronDown, ChevronRight, MessageSquare, Hash, User, ArrowRight, Globe } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useGateway } from "@/providers/GatewayProvider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AgentConfig {
  id: string;
  name: string;
  model: string | null;
  heartbeatInterval: string;
}

interface ModelOption {
  value: string;
  label: string;
}

interface ChannelSubChannel {
  id: string;
  type: string;
  allow: boolean;
  requireMention: boolean;
  agentId?: string;
  agentName?: string;
}

interface ChannelInfo {
  id: string;
  enabled: boolean;
  mode?: string;
  dmPolicy?: string;
  groupPolicy?: string;
  subChannels: ChannelSubChannel[];
  config: Record<string, unknown>;
}

interface RoutingEntry {
  agentId: string;
  agentName: string;
  channel: string;
  target: string;
}

interface GatewayConfig {
  defaultModel: string;
  contextTokens: number;
  agents: AgentConfig[];
  channels: ChannelInfo[];
  routing: RoutingEntry[];
  availableModels: ModelOption[];
}

export default function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { connected, connecting, gatewayUrl, request } = useGateway();
  const [config, setConfig] = useState<GatewayConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modelOverrides, setModelOverrides] = useState<Record<string, string>>({});
  
  // Channel expansion state
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set());
  
  // MC Password management
  const [mcPassword, setMcPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Load stored MC password on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setMcPassword(localStorage.getItem("mc_password") || "");
    }
  }, []);

  useEffect(() => {
    async function fetchConfig() {
      setLoading(true);
      try {
        // Use HTTP APIs exclusively — avoids WS operator.read scope issues
        // Use AbortController to prevent hanging requests
        const fetchWithTimeout = (url: string, timeoutMs = 8000) => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), timeoutMs);
          return fetch(url, { signal: controller.signal })
            .then(r => { clearTimeout(timeout); return r.ok ? r.json() : null; })
            .catch(() => { clearTimeout(timeout); return null; });
        };
        
        const [agentsData, statusData, configData, channelsData] = await Promise.all([
          fetchWithTimeout("/api/agents"),
          fetchWithTimeout("/api/status", 5000), // shorter timeout — this one can hang
          fetchWithTimeout("/api/config"),
          fetchWithTimeout("/api/channels"),
        ]);
        
        const agents = agentsData?.agents || [];
        const defaultModel = configData?.defaultModel || "anthropic/claude-sonnet-4-5";
        const contextTokens = configData?.contextTokens || 200000;
        const availableModels: ModelOption[] = configData?.availableModels || [
          { value: "default", label: `Default (${defaultModel})` },
        ];
        
        // Map heartbeat info from status
        const heartbeatByAgent = new Map<string, any>();
        statusData?.heartbeat?.agents?.forEach((hb: any) => {
          heartbeatByAgent.set(hb.agentId, hb);
        });
        
        // Map agent models from config endpoint
        const configAgents = new Map<string, string>();
        (configData?.agents || []).forEach((a: any) => {
          configAgents.set(a.id, a.model);
        });
        
        // Use enriched channel data from HTTP API
        const channels: ChannelInfo[] = channelsData?.channels || [];
        const routing: RoutingEntry[] = channelsData?.routing || [];
        
        setConfig({
          defaultModel,
          contextTokens,
          availableModels,
          agents: agents.map((a: any) => {
            const heartbeat = heartbeatByAgent.get(a.id);
            const modelPrimary = configAgents.get(a.id) || a.model || defaultModel;
            
            return {
              id: a.id,
              name: a.name || a.id,
              model: modelPrimary,
              heartbeatInterval: heartbeat?.every || "—",
            };
          }),
          channels,
          routing,
        });
        
        // Initialize model overrides
        const overrides: Record<string, string> = {};
        agents.forEach((a: any) => {
          const configModel = configAgents.get(a.id);
          overrides[a.id] = configModel || "default";
        });
        setModelOverrides(overrides);
      } catch (error) {
        console.error("Failed to fetch config:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, []);

  const handleModelChange = (agentId: string, model: string) => {
    setModelOverrides((prev) => ({
      ...prev,
      [agentId]: model,
    }));
  };

  const handleSaveAgentModel = async (agentId: string) => {
    if (!connected) {
      toast.error('Not connected to gateway');
      return;
    }
    
    setSaving(true);
    try {
      const model = modelOverrides[agentId];
      const res = await fetch("/api/gateway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "session.status",
          params: {
            agentId,
            model: model === "default" ? "default" : model,
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `HTTP ${res.status}`);
      }
      
      toast.success(`Model override set for ${agentId}`, {
        description: `Set to ${model === 'default' ? 'default model' : model}. Takes effect on next session.`,
      });
    } catch (error) {
      console.error('Failed to save model:', error);
      toast.error('Failed to save model configuration', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRestartGateway = async () => {
    if (!confirm("Are you sure you want to restart the OpenClaw gateway?")) {
      return;
    }

    if (!connected) {
      toast.error("Not connected to gateway");
      return;
    }

    try {
      await request("gateway.restart");
      toast.success("Gateway restart initiated", {
        description: "The connection will drop momentarily and reconnect.",
      });
    } catch (error) {
      console.error("Gateway restart error:", error);
      toast.error("Failed to restart gateway", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const handleSaveMcPassword = () => {
    if (typeof window !== "undefined") {
      if (mcPassword.trim()) {
        localStorage.setItem("mc_password", mcPassword.trim());
        toast.success("Mission Control password saved", {
          description: "Password stored in browser. Reload to re-authenticate.",
        });
      } else {
        localStorage.removeItem("mc_password");
        toast.success("Mission Control password cleared");
      }
    }
  };

  const themeOptions = [
    { value: "light", icon: Sun, label: "Light" },
    { value: "dark", icon: Moon, label: "Dark" },
    { value: "system", icon: Monitor, label: "System" },
  ] as const;

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
        <div className="text-zinc-500">Loading configuration...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
      </div>

      <div className="grid gap-6">
        {/* Authentication */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Authentication
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Mission Control password for secure access. Set MISSION_CONTROL_PASSWORD in .env.local on the server, then enter the same password here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={mcPassword}
                  onChange={(e) => setMcPassword(e.target.value)}
                  placeholder="Enter Mission Control password"
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 pr-10"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1 h-7 w-7 p-0 text-zinc-400"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <Button
                onClick={handleSaveMcPassword}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
            </div>
            <p className="text-xs text-zinc-500">
              {mcPassword ? "Password is set. It will be used for gateway authentication." : "No password set. Set one if the server requires MISSION_CONTROL_PASSWORD."}
            </p>
          </CardContent>
        </Card>

        {/* Agent Model Configuration */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
              <Bot className="w-5 h-5" />
              Agent Model Configuration
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Set model overrides for each agent. Changes take effect on next session.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {config?.agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center justify-between gap-4 p-3 bg-zinc-800/50 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-100">{agent.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {agent.id}
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    Heartbeat: {agent.heartbeatInterval}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={modelOverrides[agent.id] || "default"}
                    onValueChange={(value) => handleModelChange(agent.id, value)}
                  >
                    <SelectTrigger className="w-[220px] bg-zinc-800 border-zinc-700">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {(config?.availableModels || []).map((model) => (
                        <SelectItem key={model.value} value={model.value}>
                          {model.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleSaveAgentModel(agent.id)}
                    disabled={saving}
                    className="bg-zinc-700 hover:bg-zinc-600"
                  >
                    <Save className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            {(!config?.agents || config.agents.length === 0) && (
              <p className="text-zinc-500 text-center py-4">No agents configured</p>
            )}
          </CardContent>
        </Card>

        {/* Theme Settings */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
              {resolvedTheme === "dark" ? (
                <Moon className="w-5 h-5" />
              ) : (
                <Sun className="w-5 h-5" />
              )}
              Appearance
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Customize how Mission Control looks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-zinc-400 mb-3">Theme</p>
              <div className="flex gap-2">
                {themeOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={theme === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme(option.value)}
                    className={cn(
                      "flex items-center gap-2",
                      theme === option.value && "bg-emerald-600 hover:bg-emerald-700"
                    )}
                  >
                    <option.icon className="w-4 h-4" />
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">Current theme</span>
              <Badge variant="secondary">{resolvedTheme}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Gateway Connection */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
              <Server className="w-5 h-5" />
              Gateway Connection
            </CardTitle>
            <CardDescription className="text-zinc-400">
              OpenClaw gateway connection settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Proxy URL</span>
              <code className="text-sm bg-zinc-800 px-2 py-1 rounded text-zinc-200">
                {gatewayUrl || "Not connected"}
              </code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Status</span>
              {connected ? (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50">
                  Connected
                </Badge>
              ) : connecting ? (
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">
                  Connecting...
                </Badge>
              ) : (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/50">
                  Disconnected
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Default Model</span>
              <code className="text-sm bg-zinc-800 px-2 py-1 rounded text-zinc-200">
                {config?.defaultModel || "—"}
              </code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Security</span>
              <Badge variant="outline" className="text-xs">
                Server-side auth proxy
              </Badge>
            </div>
            <div className="pt-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRestartGateway}
                className="w-full"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Restart Gateway
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Model Aliases — Collapsible */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
              <Cpu className="w-5 h-5" />
              Available Models
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Models configured in gateway (from providers + agent defaults)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <details>
              <summary className="cursor-pointer text-sm text-zinc-300 hover:text-zinc-100 transition-colors py-1">
                Show {(config?.availableModels || []).filter(m => m.value !== "default").length} models
              </summary>
              <div className="space-y-2 mt-3">
                {(config?.availableModels || [])
                  .filter(m => m.value !== "default")
                  .map((item) => (
                  <div
                    key={item.value}
                    className="flex items-center justify-between p-2 bg-zinc-800/50 rounded"
                  >
                    <code className="text-sm text-emerald-400 truncate mr-2">{item.value}</code>
                    <span className="text-sm text-zinc-400 truncate">{item.label}</span>
                  </div>
                ))}
                {(!config?.availableModels || config.availableModels.length <= 1) && (
                  <p className="text-zinc-500 text-center py-4">No models found in config</p>
                )}
              </div>
            </details>
          </CardContent>
        </Card>

        {/* Connected Channels */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Connected Channels
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Messaging channels, routing, and configuration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {config?.channels && config.channels.length > 0 ? (
                config.channels.map((channel) => {
                  const isExpanded = expandedChannels.has(channel.id);
                  return (
                    <div key={channel.id} className="rounded-lg border border-zinc-700 overflow-hidden">
                      {/* Channel Header */}
                      <button
                        onClick={() => {
                          const next = new Set(expandedChannels);
                          if (isExpanded) next.delete(channel.id);
                          else next.add(channel.id);
                          setExpandedChannels(next);
                        }}
                        className="w-full flex items-center justify-between p-3 bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
                          <div className={cn("w-2.5 h-2.5 rounded-full", channel.enabled ? "bg-emerald-400" : "bg-red-400")} />
                          <span className="text-sm font-semibold text-zinc-100 capitalize">{channel.id}</span>
                          {channel.mode && (
                            <Badge variant="outline" className="text-[10px] text-zinc-400 border-zinc-600">
                              {channel.mode}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={cn("text-[10px]", channel.enabled ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-red-500/20 text-red-400 border-red-500/30")}>
                            {channel.enabled ? "ENABLED" : "DISABLED"}
                          </Badge>
                          <span className="text-xs text-zinc-500">{channel.subChannels.length} routes</span>
                        </div>
                      </button>
                      
                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="border-t border-zinc-700 p-3 space-y-3">
                          {/* Channel Config Summary */}
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                            {channel.dmPolicy && (
                              <div className="bg-zinc-800 rounded p-2">
                                <span className="text-zinc-500">DM Policy:</span>
                                <span className="ml-1 text-zinc-200">{channel.dmPolicy}</span>
                              </div>
                            )}
                            {channel.groupPolicy && (
                              <div className="bg-zinc-800 rounded p-2">
                                <span className="text-zinc-500">Group Policy:</span>
                                <span className="ml-1 text-zinc-200">{channel.groupPolicy}</span>
                              </div>
                            )}
                            {channel.mode && (
                              <div className="bg-zinc-800 rounded p-2">
                                <span className="text-zinc-500">Mode:</span>
                                <span className="ml-1 text-zinc-200">{channel.mode}</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Sub-channels / Routing */}
                          {channel.subChannels.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-zinc-400 uppercase mb-2">Agent Routing</h4>
                              <div className="space-y-1.5">
                                {channel.subChannels.map((sub) => (
                                  <div key={sub.id} className="flex items-center justify-between p-2 bg-zinc-800/30 rounded border border-zinc-700/50">
                                    <div className="flex items-center gap-2">
                                      {sub.type === 'dm' ? (
                                        <User className="w-3.5 h-3.5 text-blue-400" />
                                      ) : sub.type === 'wildcard' ? (
                                        <Globe className="w-3.5 h-3.5 text-purple-400" />
                                      ) : (
                                        <Hash className="w-3.5 h-3.5 text-zinc-400" />
                                      )}
                                      <span className="text-xs font-mono text-zinc-300">{sub.id === '*' ? 'All' : sub.id}</span>
                                      {!sub.allow && (
                                        <Badge variant="outline" className="text-[9px] text-red-400 border-red-500/30">BLOCKED</Badge>
                                      )}
                                      {sub.requireMention && (
                                        <Badge variant="outline" className="text-[9px] text-amber-400 border-amber-500/30">@mention</Badge>
                                      )}
                                    </div>
                                    {sub.agentName ? (
                                      <div className="flex items-center gap-1.5">
                                        <ArrowRight className="w-3 h-3 text-zinc-500" />
                                        <Badge className="text-[10px] bg-blue-500/20 text-blue-400 border-blue-500/30">
                                          {sub.agentName}
                                        </Badge>
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-zinc-500">default agent</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Raw Config (collapsible) */}
                          {Object.keys(channel.config).length > 0 && (
                            <details className="text-xs">
                              <summary className="text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors">
                                Raw Configuration
                              </summary>
                              <pre className="mt-2 p-2 bg-zinc-950 rounded text-zinc-400 overflow-x-auto text-[11px]">
                                {JSON.stringify(channel.config, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-zinc-500 text-center py-4">No channels configured</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Agent Routing Summary */}
        {config?.routing && config.routing.length > 0 && (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
                <ArrowRight className="w-5 h-5" />
                Agent Routing
              </CardTitle>
              <CardDescription className="text-zinc-400">
                How messages are routed to agents across channels
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {config.routing.map((route, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2.5 bg-zinc-800/30 rounded border border-zinc-700/50">
                    <Badge variant="outline" className="text-[10px] capitalize border-zinc-600">{route.channel}</Badge>
                    <span className="text-xs text-zinc-400">{route.target === 'all' ? 'All messages' : route.target}</span>
                    <ArrowRight className="w-3 h-3 text-zinc-500 ml-auto" />
                    <Badge className="text-[10px] bg-blue-500/20 text-blue-400 border-blue-500/30">
                      {route.agentName}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Application Info */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
              <Database className="w-5 h-5" />
              Application Info
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Mission Control version and storage
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Version</span>
              <span className="text-zinc-200">1.2.0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Port</span>
              <span className="text-zinc-200">3333</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Database</span>
              <code className="text-sm bg-zinc-800 px-2 py-1 rounded text-zinc-200">
                ~/.openclaw/data/tasks.db
              </code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Environment</span>
              <Badge variant="secondary">Development</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
