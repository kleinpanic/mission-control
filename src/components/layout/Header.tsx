"use client";

import { useRealtimeStore } from "@/stores/realtime";
import { RefreshCw, Wifi, WifiOff, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Header() {
  const { connectionStatus, connectionError } = useRealtimeStore();

  const statusConfig = {
    connected: {
      icon: Wifi,
      text: "Connected",
      className: "text-green-500",
    },
    connecting: {
      icon: RefreshCw,
      text: "Connecting...",
      className: "text-yellow-500 animate-spin",
    },
    disconnected: {
      icon: WifiOff,
      text: "Disconnected",
      className: "text-zinc-500",
    },
    error: {
      icon: AlertCircle,
      text: "Error",
      className: "text-red-500",
    },
  };

  const status = statusConfig[connectionStatus];
  const StatusIcon = status.icon;

  return (
    <header className="h-16 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-zinc-100">
          OpenClaw Dashboard
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Connection Status */}
        <div className="flex items-center gap-2 text-sm">
          <StatusIcon className={cn("w-4 h-4", status.className)} />
          <span className="text-zinc-400">{status.text}</span>
          {connectionError && (
            <span className="text-red-400 text-xs">({connectionError})</span>
          )}
        </div>

        {/* Refresh Button */}
        <Button
          variant="ghost"
          size="sm"
          className="text-zinc-400 hover:text-white"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>
    </header>
  );
}
