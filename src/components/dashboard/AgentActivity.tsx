"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Zap, GitBranch } from "lucide-react";

interface Session {
  key: string;
  label: string | null;
  agentId: string;
  model: string;
  status: string;
  totalTokens: number;
  parentKey?: string;
}

interface AgentActivityProps {
  className?: string;
}

export function AgentActivity({ className }: AgentActivityProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  async function fetchSessions() {
    try {
      const res = await fetch('/api/sessions');
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  }

  // Group sessions by agent
  const agentGroups = sessions.reduce((acc, session) => {
    const agent = session.agentId || 'unknown';
    if (!acc[agent]) acc[agent] = [];
    acc[agent].push(session);
    return acc;
  }, {} as Record<string, Session[]>);

  // Find subagents and swarms (sessions with parent relationships)
  const hierarchicalSessions = sessions.filter(s => s.parentKey || s.label?.includes('swarm'));

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Agent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Agent Activity
          <Badge variant="outline" className="ml-auto">
            {sessions.length} active
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hierarchical sessions (subagents, swarms) */}
        {hierarchicalSessions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <GitBranch className="h-4 w-4" />
              Parallel Work
            </div>
            <div className="space-y-1">
              {hierarchicalSessions.map((session) => (
                <div
                  key={session.key}
                  className="flex items-center justify-between rounded-md bg-muted/50 p-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    {session.label?.includes('swarm') ? (
                      <Zap className="h-4 w-4 text-yellow-500" />
                    ) : (
                      <GitBranch className="h-4 w-4 text-blue-500" />
                    )}
                    <span className="font-mono text-xs">
                      {session.label || session.key.split(':').slice(-1)[0]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {session.agentId}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(session.totalTokens / 1000)}k tokens
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Agent breakdown */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">
            By Agent
          </div>
          <div className="grid gap-2">
            {Object.entries(agentGroups)
              .sort((a, b) => b[1].length - a[1].length)
              .map(([agentId, agentSessions]) => (
                <div
                  key={agentId}
                  className="flex items-center justify-between rounded-md border p-2"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="default">{agentId}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {agentSessions.length} session{agentSessions.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {agentSessions.some(s => s.label?.includes('swarm')) && (
                      <Zap className="h-4 w-4 text-yellow-500" />
                    )}
                    {agentSessions.some(s => s.parentKey) && (
                      <GitBranch className="h-4 w-4 text-blue-500" />
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Empty state */}
        {sessions.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No active sessions
          </div>
        )}
      </CardContent>
    </Card>
  );
}
