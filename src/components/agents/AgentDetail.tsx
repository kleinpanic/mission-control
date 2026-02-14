"use client";

import { useState } from "react";
import { Agent } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSessionsStore } from "@/stores/sessions";
import { Send, History, RefreshCw, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentDetailProps {
  agent: Agent;
}

export function AgentDetail({ agent }: AgentDetailProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const { sessions } = useSessionsStore();

  // Get sessions for this agent
  const agentSessions = sessions.filter((s) => {
    const sessionAgentId = s.agentId || s.key.split(":")[1];
    return sessionAgentId === agent.id;
  });

  const handleSendMessage = async () => {
    if (!message.trim() || !agent.activeSession) return;

    setSending(true);
    try {
      // TODO: Implement actual message sending via API
      console.log(`Sending to ${agent.id}: ${message}`);
      setMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border-t border-zinc-800 bg-zinc-800/30 p-4 space-y-4">
      {/* Sessions List */}
      <div>
        <h4 className="text-sm font-medium text-zinc-300 mb-2">
          Sessions ({agentSessions.length})
        </h4>
        {agentSessions.length === 0 ? (
          <p className="text-sm text-zinc-500">No active sessions</p>
        ) : (
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {agentSessions.slice(0, 5).map((session) => (
              <div
                key={session.key}
                className="flex items-center justify-between p-2 bg-zinc-800/50 rounded text-sm"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-zinc-300 truncate">{session.key}</p>
                  <p className="text-xs text-zinc-500">
                    {session.tokens ? `${session.tokens.used.toLocaleString()} / ${session.tokens.limit.toLocaleString()} tokens` : 'No token data'}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="text-zinc-400">
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
        >
          <History className="w-4 h-4 mr-2" />
          View History
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
          title="Force Heartbeat"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Send Message */}
      <div>
        <h4 className="text-sm font-medium text-zinc-300 mb-2">
          Send Message
        </h4>
        <div className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={`Message ${agent.name || agent.id}...`}
            className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!message.trim() || sending}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
