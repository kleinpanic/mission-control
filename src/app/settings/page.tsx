"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings, Server, Database, Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const themeOptions = [
    { value: "light", icon: Sun, label: "Light" },
    { value: "dark", icon: Moon, label: "Dark" },
    { value: "system", icon: Monitor, label: "System" },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <div className="grid gap-6">
        {/* Theme Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {resolvedTheme === "dark" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              Appearance
            </CardTitle>
            <CardDescription>
              Customize how Mission Control looks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-3">Theme</p>
              <div className="flex gap-2">
                {themeOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={theme === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme(option.value)}
                    className={cn(
                      "flex items-center gap-2",
                      theme === option.value && "bg-primary text-primary-foreground"
                    )}
                  >
                    <option.icon className="w-4 h-4" />
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Current theme</span>
              <Badge variant="secondary">{resolvedTheme}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Connection Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Server className="w-5 h-5" />
              Gateway Connection
            </CardTitle>
            <CardDescription>
              OpenClaw gateway connection settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">WebSocket URL</span>
              <code className="text-sm bg-muted px-2 py-1 rounded">
                ws://127.0.0.1:18789
              </code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
                Connected
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Application Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Application Info
            </CardTitle>
            <CardDescription>
              Mission Control version and configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Version</span>
              <span>1.0.0-mvp</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Port</span>
              <span>3333</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Environment</span>
              <Badge variant="secondary">Development</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Data Storage */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="w-5 h-5" />
              Data Storage
            </CardTitle>
            <CardDescription>
              Local SQLite database for tasks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Database</span>
              <code className="text-sm bg-muted px-2 py-1 rounded">
                data/tasks.db
              </code>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
