'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, MessageSquare, DollarSign, Clock } from 'lucide-react';
import { useAgentsStore } from '@/stores/agents';
import { useSessionsStore } from '@/stores/sessions';
import { useRealtimeStore } from '@/stores/realtime';

export default function Dashboard() {
  const { agents } = useAgentsStore();
  const { sessions } = useSessionsStore();
  const { events } = useRealtimeStore();
  const [todayCost, setTodayCost] = useState(0);
  const [nextHeartbeat, setNextHeartbeat] = useState<string | null>(null);

  useEffect(() => {
    // Fetch initial data
    fetch('/api/gateway', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'sessions.list', params: {} }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.result) {
          useSessionsStore.getState().setSessions(data.result.sessions || []);
        }
      })
      .catch(console.error);

    // Fetch costs
    fetch('/api/costs')
      .then((res) => res.json())
      .then((data) => {
        if (data.summary) {
          setTodayCost(data.summary.today);
        }
      })
      .catch(console.error);

    // Poll for updates every 5 seconds
    const interval = setInterval(() => {
      fetch('/api/gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'sessions.list', params: {} }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.result) {
            useSessionsStore.getState().setSessions(data.result.sessions || []);
          }
        })
        .catch(console.error);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const activeAgents = agents.filter((a) => a.status === 'active').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Real-time overview of your OpenClaw system</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeAgents}/{agents.length || 6}</div>
            <p className="text-xs text-muted-foreground">Agents with recent activity</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sessions.length}</div>
            <p className="text-xs text-muted-foreground">Active conversations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(todayCost ?? 0).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Total spending</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Heartbeat</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{nextHeartbeat || '~15m'}</div>
            <p className="text-xs text-muted-foreground">Countdown to next check</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent events</p>
            ) : (
              events.slice(0, 10).map((event, idx) => (
                <div key={idx} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{event.type}</p>
                    {event.agentId && (
                      <p className="text-xs text-muted-foreground">Agent: {event.agentId}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
