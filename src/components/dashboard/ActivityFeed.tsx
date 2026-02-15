"use client";

import { useState, useMemo } from "react";
import { Event } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAgentName } from "@/lib/agentNames";
import {
  Play,
  CheckCircle,
  MessageSquare,
  Clock,
  AlertCircle,
  Activity,
  Filter,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const [typeFilters, setTypeFilters] = useState<Set<string>>(new Set());
  const [agentFilters, setAgentFilters] = useState<Set<string>>(new Set());

  // Extract unique event types and agents from current events
  const { eventTypes, agents } = useMemo(() => {
    const types = new Set<string>();
    const agentSet = new Set<string>();
    for (const event of events) {
      types.add(event.type);
      if (event.agentId) agentSet.add(event.agentId);
    }
    return { eventTypes: Array.from(types).sort(), agents: Array.from(agentSet).sort() };
  }, [events]);

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (typeFilters.size > 0 && !typeFilters.has(event.type)) return false;
      if (agentFilters.size > 0 && event.agentId && !agentFilters.has(event.agentId)) return false;
      if (agentFilters.size > 0 && !event.agentId) return false;
      return true;
    });
  }, [events, typeFilters, agentFilters]);

  const hasFilters = typeFilters.size > 0 || agentFilters.size > 0;

  const toggleTypeFilter = (type: string) => {
    setTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const toggleAgentFilter = (agent: string) => {
    setAgentFilters((prev) => {
      const next = new Set(prev);
      if (next.has(agent)) {
        next.delete(agent);
      } else {
        next.add(agent);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setTypeFilters(new Set());
    setAgentFilters(new Set());
  };

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
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-zinc-100">Recent Activity</CardTitle>
          <div className="flex items-center gap-1">
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-7 px-2 text-xs text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-3 h-3 mr-1" />
                Clear
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 px-2",
                    hasFilters
                      ? "text-blue-400 hover:text-blue-300"
                      : "text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  <Filter className="w-3.5 h-3.5 mr-1" />
                  Filter
                  {hasFilters && (
                    <Badge className="ml-1 h-4 px-1 text-[10px] bg-blue-500/20 text-blue-400 border-none">
                      {typeFilters.size + agentFilters.size}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 bg-zinc-900 border-zinc-700">
                {agents.length > 0 && (
                  <>
                    <DropdownMenuLabel className="text-xs text-zinc-400">
                      Agents
                    </DropdownMenuLabel>
                    {agents.map((agent) => (
                      <DropdownMenuCheckboxItem
                        key={agent}
                        checked={agentFilters.has(agent)}
                        onCheckedChange={() => toggleAgentFilter(agent)}
                        className="text-sm"
                      >
                        {agent}
                      </DropdownMenuCheckboxItem>
                    ))}
                    <DropdownMenuSeparator className="bg-zinc-700" />
                  </>
                )}
                <DropdownMenuLabel className="text-xs text-zinc-400">
                  Event Types
                </DropdownMenuLabel>
                {eventTypes.map((type) => {
                  const config = eventConfig[type];
                  return (
                    <DropdownMenuCheckboxItem
                      key={type}
                      checked={typeFilters.has(type)}
                      onCheckedChange={() => toggleTypeFilter(type)}
                      className="text-sm"
                    >
                      {config?.label || type}
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {hasFilters && (
          <p className="text-xs text-zinc-500">
            Showing {filteredEvents.length} of {events.length} events
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-6 text-zinc-500">
              <Filter className="w-6 h-6 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No events match filters</p>
            </div>
          ) : (
            filteredEvents.slice(0, 20).map((event, index) => {
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-zinc-100">
                        {event.agentId ? getAgentName(event.agentId) : "System"}
                      </span>
                      {event.agentId && (
                        <span className="text-xs text-zinc-500 font-mono">({event.agentId})</span>
                      )}
                      <Badge variant="secondary" className="text-xs bg-zinc-700 text-zinc-300">
                        {config.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-zinc-400 truncate mt-0.5">
                      {getEventDescription(event)}
                    </p>
                  </div>
                  <span className="text-xs text-zinc-500 whitespace-nowrap">
                    {formatTime(event.timestamp)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
