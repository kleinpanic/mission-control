"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, Server, Database, Moon, Sun, Monitor, Bot, Cpu, RefreshCw, Save } from "lucide-react";
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

interface GatewayConfig {
  defaultModel: string;
  contextTokens: number;
  agents: AgentConfig[];
  channels: string[];
}

function getAvailableModels(defaultModel?: string) {
  return [
    { value: "default", label: defaultModel ? `Default (${defaultModel})` : "Default" },
    { value: "gpt-5.2", label: "GPT-5.2 (OpenAI)" },
    { value: "anthropic/claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
    { value: "anthropic/claude-opus-4-5", label: "Claude Opus 4.5" },
    { value: "anthropic-nick/claude-opus-4-5", label: "Claude Opus 4.5 (Nick)" },
    { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash" },
    { value: "google/gemini-3-pro-preview", label: "Gemini 3 Pro" },
  ];
}

export default function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { connected, connecting, gatewayUrl, request } = useGateway();
  const [config, setConfig] = useState<GatewayConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modelOverrides, setModelOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchConfig() {
      if (!connected) {
        if (!connecting) setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        const [agentsResult, statusResult, configResult] = await Promise.all([
          request<any>("agents.list").catch(e => { console.error("agents.list error:", e); return null; }),
          request<any>("status").catch(e => { console.error("status error:", e); return null; }),
          request<any>("gateway.config.get").catch(e => { console.error("gateway.config.get error:", e); return null; }),
        ]);
        
        if (agentsResult && statusResult) {
          const agents = agentsResult.agents || [];
          
          // Map heartbeat info
          const heartbeatByAgent = new Map<string, any>();
          statusResult.heartbeat?.agents?.forEach((hb: any) => {
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
          
          // Extract channels from config
          const channels = configResult?.config?.channels ? Object.keys(configResult.config.channels) : [];
          
          // Debug logging
          console.log('[Settings] Config result:', configResult);
          console.log('[Settings] Extracted channels:', channels);
          
          setConfig({
            defaultModel,
            contextTokens,
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
          
          // Initialize model overrides from current agent models
          const overrides: Record<string, string> = {};
          agents.forEach((a: any) => {
            overrides[a.id] = a.model || "default";
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
      
      // Use session_status-style model override via the gateway API proxy
      // This avoids rewriting the full config and is safer
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
                    <SelectTrigger className="w-[200px] bg-zinc-800 border-zinc-700">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableModels(config?.defaultModel).map((model) => (
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
              <span className="text-zinc-400">WebSocket URL</span>
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
                {config?.defaultModel || "gpt-5.2"}
              </code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Context Limit</span>
              <span className="text-zinc-200">
                {(config?.contextTokens || 200000).toLocaleString()} tokens
              </span>
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
              Model Aliases
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Quick model shortcuts for chat commands
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { alias: "gpt", model: "openai/gpt-5.2" },
              { alias: "sonnet", model: "anthropic/claude-sonnet-4-5" },
              { alias: "opus", model: "anthropic/claude-opus-4-5" },
              { alias: "flash", model: "google/gemini-3-flash-preview" },
            ].map((item) => (
              <div
                key={item.alias}
                className="flex items-center justify-between p-2 bg-zinc-800/50 rounded"
              >
                <code className="text-sm text-emerald-400">/model {item.alias}</code>
                <span className="text-sm text-zinc-400">{item.model}</span>
              </div>
            ))}
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
              {config?.channels.map((channel, idx) => (
                <div key={idx} className="p-2 bg-zinc-800/50 rounded text-sm text-zinc-300">
                  {channel}
                </div>
              )) || <p className="text-zinc-500">No channels configured</p>}
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
              <span className="text-zinc-200">1.1.0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Port</span>
              <span className="text-zinc-200">3333</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Database</span>
              <code className="text-sm bg-zinc-800 px-2 py-1 rounded text-zinc-200">
                data/tasks.db
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
