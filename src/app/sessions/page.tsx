"use client";

import { useEffect, useState } from "react";
import { useSessionsStore } from "@/stores/sessions";
import { Session } from "@/types";
import { SessionTable } from "@/components/sessions/SessionTable";
import { SessionDetail } from "@/components/sessions/SessionDetail";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export default function SessionsPage() {
  const { sessions, setSessions, loading, setLoading } = useSessionsStore();
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sessions");
      const data = await res.json();
      if (data.sessions) {
        setSessions(data.sessions);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch sessions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleSelectSession = (session: Session) => {
    setSelectedSession(session);
  };

  const handleCloseDetail = () => {
    setSelectedSession(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-100">Sessions</h1>
        <Button
          variant="secondary"
          size="sm"
          onClick={fetchSessions}
          disabled={loading}
          className="bg-zinc-800 hover:bg-zinc-700"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={selectedSession ? "lg:col-span-2" : "lg:col-span-3"}>
          <SessionTable
            sessions={sessions}
            loading={loading}
            onSelectSession={handleSelectSession}
            selectedSessionKey={selectedSession?.key}
          />
        </div>

        {selectedSession && (
          <div className="lg:col-span-1">
            <SessionDetail
              session={selectedSession}
              onClose={handleCloseDetail}
            />
          </div>
        )}
      </div>
    </div>
  );
}
