"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, Server, Clock, Database } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
      </div>

      <div className="grid gap-6">
        {/* Connection Settings */}
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
              <span className="text-zinc-300">WebSocket URL</span>
              <code className="text-sm bg-zinc-800 px-2 py-1 rounded text-zinc-400">
                ws://127.0.0.1:18789
              </code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-300">Status</span>
              <Badge className="bg-green-900/50 text-green-400">Connected</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Application Info */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Application Info
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Mission Control version and configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-zinc-300">Version</span>
              <span className="text-zinc-400">1.0.0-mvp</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-300">Port</span>
              <span className="text-zinc-400">3333</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-300">Environment</span>
              <Badge variant="secondary" className="bg-zinc-700">Development</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Data Storage */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg text-zinc-100 flex items-center gap-2">
              <Database className="w-5 h-5" />
              Data Storage
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Local SQLite database for tasks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-zinc-300">Database</span>
              <code className="text-sm bg-zinc-800 px-2 py-1 rounded text-zinc-400">
                data/tasks.db
              </code>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
