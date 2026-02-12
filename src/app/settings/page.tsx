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

const AVAILABLE_MODELS = [
  { value: "default", label: "Default (gpt-5.2)" },
  { value: "gpt-5.2", label: "GPT-5.2 (OpenAI)" },
  { value: "anthropic/claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
  { value: "anthropic/claude-opus-4-5", label: "Claude Opus 4.5" },
  { value: "anthropic-nick/claude-opus-4-5", label: "Claude Opus 4.5 (Nick)" },
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash" },
  { value: "google/gemini-3-pro-preview", label: "Gemini 3 Pro" },
];

export default function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [config, setConfig] = useState<GatewayConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modelOverrides, setModelOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch("/api/status");
        if (res.ok) {
          const data = await res.json();
          const agents = data.agents || [];
          setConfig({
            defaultModel: "gpt-5.2",
            contextTokens: 200000,
            agents: agents.map((a: any) => ({
              id: a.id,
              name: a.name,
              model: a.model,
              heartbeatInterval: a.heartbeatInterval,
            })),
            channels: data.channels || [],
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
  }, []);

  const handleModelChange = (agentId: string, model: string) => {
    setModelOverrides((prev) => ({
      ...prev,
      [agentId]: model,
    }));
  };

  const handleSaveAgentModel = async (agentId: string) => {
    setSaving(true);
    try {
      // This would need to be implemented in the gateway API
      // For now, show info about how to change models
      toast.info(`Model override for ${agentId}: Use /model ${modelOverrides[agentId]} in chat`, {
        description: "Per-agent config requires gateway restart",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRestartGateway = async () => {
    if (!confirm("Are you sure you want to restart the OpenClaw gateway?")) {
      return;
    }

    try {
      const res = await fetch("/api/gateway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restart" }),
      });

      if (res.ok) {
        toast.success("Gateway restart initiated");
      } else {
        toast.error("Failed to restart gateway");
      }
    } catch (error) {
      toast.error("Failed to restart gateway");
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
                      {AVAILABLE_MODELS.map((model) => (
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
                ws://127.0.0.1:18789
              </code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Status</span>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50">
                Connected
              </Badge>
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
