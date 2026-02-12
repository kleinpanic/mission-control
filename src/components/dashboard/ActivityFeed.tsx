"use client";

import { Event } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Play,
  CheckCircle,
  MessageSquare,
  Clock,
  AlertCircle,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityFeedProps {
  events: Event[];
}

const eventConfig: Record<string, { icon: any; color: string; label: string }> = {
  "agent.run.start": {
    icon: Play,
    color: "text-blue-400",
    label: "Started",
  },
  "agent.run.end": {
    icon: CheckCircle,
    color: "text-green-400",
    label: "Completed",
  },
  "session.message": {
    icon: MessageSquare,
    color: "text-zinc-400",
    label: "Message",
  },
  "cron.job.run": {
    icon: Clock,
    color: "text-purple-400",
    label: "Cron Run",
  },
  "cron.job.end": {
    icon: CheckCircle,
    color: "text-purple-400",
    label: "Cron Done",
  },
  "session.created": {
    icon: Activity,
    color: "text-cyan-400",
    label: "Session Created",
  },
  "session.ended": {
    icon: CheckCircle,
    color: "text-zinc-400",
    label: "Session Ended",
  },
  error: {
    icon: AlertCircle,
    color: "text-red-400",
    label: "Error",
  },
};

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getEventDescription(event: Event): string {
  switch (event.type) {
    case "agent.run.start":
      return `${event.agentId || "Agent"} started processing`;
    case "agent.run.end":
      return `${event.agentId || "Agent"} completed task`;
    case "session.message":
      return `Message in ${event.sessionKey || "session"}`;
    case "cron.job.run":
      return `Cron job ${event.data?.jobId || ""} started`;
    case "cron.job.end":
      return `Cron job ${event.data?.jobId || ""} completed`;
    case "error":
      return event.data?.message || "An error occurred";
    default:
      return event.type;
  }
}

export function ActivityFeed({ events }: ActivityFeedProps) {
  if (events.length === 0) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-100">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-zinc-500">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No recent activity</p>
            <p className="text-xs mt-1">Events will appear here in real-time</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-lg text-zinc-100">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {events.slice(0, 20).map((event, index) => {
            const config = eventConfig[event.type] || {
              icon: Activity,
              color: "text-zinc-400",
              label: event.type,
            };
            const Icon = config.icon;

            return (
              <div
                key={`${event.timestamp}-${index}`}
                className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
              >
                <div className={cn("p-1.5 rounded", config.color, "bg-zinc-800")}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-100">
                      {event.agentId || "System"}
                    </span>
                    <Badge variant="secondary" className="text-xs bg-zinc-700 text-zinc-300">
                      {config.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-zinc-400 truncate">
                    {getEventDescription(event)}
                  </p>
                </div>
                <span className="text-xs text-zinc-500 whitespace-nowrap">
                  {formatTime(event.timestamp)}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
