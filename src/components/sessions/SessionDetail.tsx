"use client";

import { useState, useEffect } from "react";
import { Session, Message } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { X, Send, History, User, Bot, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface SessionDetailProps {
  session: Session;
  onClose: () => void;
}

export function SessionDetail({ session, onClose }: SessionDetailProps) {
  const [messages, setMessages] = useState<Message[]>(session.messages || []);
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/gateway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "sessions.history",
          params: { sessionKey: session.key, limit: 20 },
        }),
      });
      const data = await res.json();
      if (data.result?.messages) {
        setMessages(data.result.messages);
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      await fetch("/api/gateway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "sessions.send",
          params: { sessionKey: session.key, message: newMessage },
        }),
      });
      setNewMessage("");
      // Refresh messages
      setTimeout(fetchHistory, 1000);
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  };

  const contextPercent = Math.round(
    (session.tokens.used / session.tokens.limit) * 100
  );

  return (
    <Card className="bg-zinc-900 border-zinc-800 sticky top-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-zinc-100">Session Detail</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Session Info */}
        <div className="space-y-2">
          <p className="text-xs text-zinc-500 font-mono break-all">
            {session.key}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs bg-zinc-700">
              {session.kind}
            </Badge>
            <Badge variant="secondary" className="text-xs bg-zinc-700">
              {session.model}
            </Badge>
            {session.compactions > 0 && (
              <Badge variant="secondary" className="text-xs bg-yellow-900/50 text-yellow-400">
                {session.compactions} compactions
              </Badge>
            )}
          </div>
        </div>

        {/* Token Usage */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Context</span>
            <span className="text-zinc-100">
              {session.tokens.used.toLocaleString()} / {session.tokens.limit.toLocaleString()}
            </span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                contextPercent > 80
                  ? "bg-red-500"
                  : contextPercent > 50
                  ? "bg-yellow-500"
                  : "bg-green-500"
              )}
              style={{ width: `${contextPercent}%` }}
            />
          </div>
        </div>

        {/* Cost */}
        {session.cost && (
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Session Cost</span>
            <span className="text-zinc-100">${(session.cost?.total ?? 0).toFixed(4)}</span>
          </div>
        )}

        {/* Recent Messages */}
        <div className="border-t border-zinc-800 pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-zinc-300">Recent Messages</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchHistory}
              disabled={loading}
            >
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 bg-zinc-800" />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-4">
              No messages yet
            </p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {messages.slice(0, 10).map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "p-2 rounded text-sm",
                    msg.role === "user"
                      ? "bg-blue-900/20 border border-blue-800/50"
                      : msg.role === "assistant"
                      ? "bg-zinc-800"
                      : "bg-zinc-800/50"
                  )}
                >
                  <div className="flex items-center gap-1 mb-1">
                    {msg.role === "user" ? (
                      <User className="w-3 h-3 text-blue-400" />
                    ) : (
                      <Bot className="w-3 h-3 text-zinc-400" />
                    )}
                    <span className="text-xs text-zinc-500">{msg.role}</span>
                  </div>
                  <p className="text-zinc-300 line-clamp-3">{msg.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Send Message */}
        <div className="border-t border-zinc-800 pt-4">
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Send a message..."
              className="bg-zinc-800 border-zinc-700"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || sending}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
