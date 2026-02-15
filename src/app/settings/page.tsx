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
import { Settings, Server, Database, Moon, Sun, Monitor, Bot, Cpu, RefreshCw, Save, Lock, Eye, EyeOff } from "lucide-react";
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

interface GatewayConfig {
  defaultModel: string;
  contextTokens: number;
  agents: AgentConfig[];
  channels: string[];
  availableModels: ModelOption[];
}

export default function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { connected, connecting, gatewayUrl, request } = useGateway();
  const [config, setConfig] = useState<GatewayConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modelOverrides, setModelOverrides] = useState<Record<string, string>>({});
  
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
      if (!connected) {
        if (!connecting) setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        const [agentsResult, statusResult, configResult, channelsResult] = await Promise.all([
          request<any>("agents.list").catch(e => { console.error("agents.list error:", e); return null; }),
          request<any>("status").catch(e => { console.error("status error:", e); return null; }),
          request<any>("config.get").catch(e => { console.error("config.get error:", e); return null; }),
          request<any>("channels.status").catch(e => { console.error("channels.status error:", e); return null; }),
        ]);
        
        if (agentsResult || statusResult) {
          const agents = agentsResult?.agents || [];
          
          // Map heartbeat info
          const heartbeatByAgent = new Map<string, any>();
          statusResult?.heartbeat?.agents?.forEach((hb: any) => {
            heartbeatByAgent.set(hb.agentId, hb);
          });
          
          // Extract default model and context from config
          const defaultModel = configResult?.config?.agents?.defaults?.model?.primary || "anthropic/claude-sonnet-4-5";
          const contextTokens = configResult?.config?.session?.contextTokens || 200000;
          
          // Extract agent models from config
          const agentConfigs = new Map<string, any>();
          if (configResult?.config?.agents?.list) {
            configResult.config.agents.list.forEach((a: any) => {
              agentConfigs.set(a.id, a.model);
            });
          }
          
          // Build dynamic model list from config
          const availableModels: ModelOption[] = [
            { value: "default", label: `Default (${defaultModel})` },
          ];
          
          // Add models from providers in config
          const providers = configResult?.config?.models?.providers || {};
          const seenModels = new Set<string>();
          for (const [providerId, providerConfig] of Object.entries(providers) as [string, any][]) {
            for (const model of providerConfig?.models || []) {
              const fullId = `${providerId}/${model.id}`;
              if (!seenModels.has(fullId)) {
                seenModels.add(fullId);
                availableModels.push({
                  value: fullId,
                  label: model.name || `${providerId}/${model.id}`,
                });
              }
            }
          }
          
          // Also add models from agent defaults.models
          const defaultModels = configResult?.config?.agents?.defaults?.models || {};
          for (const [modelId, modelConfig] of Object.entries(defaultModels) as [string, any][]) {
            if (!seenModels.has(modelId)) {
              seenModels.add(modelId);
              const alias = modelConfig?.alias ? ` (${modelConfig.alias})` : "";
              availableModels.push({
                value: modelId,
                label: `${modelId}${alias}`,
              });
            }
          }
          
          // Also add models from individual agent configs (in case they use a model not in providers list)
          for (const [, agentModel] of agentConfigs.entries()) {
            const primary = agentModel?.primary;
            if (primary && !seenModels.has(primary)) {
              seenModels.add(primary);
              availableModels.push({
                value: primary,
                label: primary,
              });
            }
          }
          
          // Extract channels
          let channels: string[] = [];
          if (channelsResult?.channelMeta && Array.isArray(channelsResult.channelMeta) && channelsResult.channelMeta.length > 0) {
            channels = channelsResult.channelMeta.map((ch: any) => 
              ch.label || ch.detailLabel || ch.id || 'unknown'
            );
          } else if (channelsResult?.channelOrder && Array.isArray(channelsResult.channelOrder) && channelsResult.channelOrder.length > 0) {
            channels = channelsResult.channelOrder;
          }
          
          if (channels.length === 0 && configResult?.config?.channels) {
            channels = Object.keys(configResult.config.channels).filter(key => {
              const channelConfig = configResult.config.channels[key];
              return channelConfig && (channelConfig.enabled !== false);
            });
          }
          
          setConfig({
            defaultModel,
            contextTokens,
            availableModels,
            agents: agents.map((a: any) => {
              const heartbeat = heartbeatByAgent.get(a.id);
              const agentModelConfig = agentConfigs.get(a.id);
              const modelPrimary = agentModelConfig?.primary || defaultModel;
              
              return {
                id: a.id,
                name: a.name,
                model: modelPrimary,
                heartbeatInterval: heartbeat?.every || "—",
              };
            }),
            channels,
          });
          
          // Initialize model overrides from config (not runtime agents.list)
          const overrides: Record<string, string> = {};
          agents.forEach((a: any) => {
            const configModel = agentConfigs.get(a.id);
            const modelPrimary = configModel?.primary;
            // Show the config-defined model, or "default" if inheriting from defaults
            overrides[a.id] = modelPrimary || "default";
          });
          setModelOverrides(overrides);
        }
      } catch (error) {
        console.error("Failed to fetch config:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, [connected, connecting, request]);

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

        {/* Model Aliases */}
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
          <CardContent className="space-y-2">
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
          </CardContent>
        </Card>

        {/* Connected Channels */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Connected Channels
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Messaging channels configured in OpenClaw
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {config?.channels && config.channels.length > 0 ? (
                config.channels.map((channel, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2.5 bg-zinc-800/50 rounded-lg border border-zinc-700">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-sm font-medium text-zinc-200">{channel}</span>
                  </div>
                ))
              ) : (
                <p className="text-zinc-500 text-center py-4">No channels configured</p>
              )}
            </div>
          </CardContent>
        </Card>

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
