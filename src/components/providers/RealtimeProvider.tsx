"use client";

import { createContext, useContext, useEffect, useRef, ReactNode } from "react";
import { useRealtimeStore } from "@/stores/realtime";
import { useAgentsStore } from "@/stores/agents";
import { useSessionsStore } from "@/stores/sessions";
import { Event, ConnectionStatus } from "@/types";

interface RealtimeContextValue {
  sendMessage: (method: string, params?: any) => Promise<any>;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error("useRealtime must be used within RealtimeProvider");
  }
  return context;
}

interface Props {
  children: ReactNode;
}

export function RealtimeProvider({ children }: Props) {
  const wsRef = useRef<WebSocket | null>(null);
  const pendingRequests = useRef<Map<string, { resolve: (value: any) => void; reject: (error: any) => void }>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;

  const { setConnectionStatus, addEvent } = useRealtimeStore();
  const { setAgents } = useAgentsStore();
  const { setSessions } = useSessionsStore();

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setConnectionStatus("connecting");

    const ws = new WebSocket("ws://127.0.0.1:18789");
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttempts.current = 0;
      setConnectionStatus("connected");

      // Authenticate
      const authId = crypto.randomUUID();
      ws.send(JSON.stringify({
        id: authId,
        method: "authenticate",
        params: { token: process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_TOKEN || "" },
      }));

      // Fetch initial data
      fetchInitialData();
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleMessage(message);
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setConnectionStatus("error", "Connection error");
    };

    ws.onclose = () => {
      setConnectionStatus("disconnected");
      wsRef.current = null;

      // Auto-reconnect with exponential backoff
      if (reconnectAttempts.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current++;
        console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      }
    };
  };

  const handleMessage = (message: any) => {
    // Check if it's a response to a pending request
    if (message.id && pendingRequests.current.has(message.id)) {
      const { resolve, reject } = pendingRequests.current.get(message.id)!;
      pendingRequests.current.delete(message.id);

      if (message.error) {
        reject(new Error(message.error.message || "Unknown error"));
      } else {
        resolve(message.result);
      }
      return;
    }

    // Check if it's an event
    if (message.type) {
      const event: Event = {
        type: message.type,
        timestamp: new Date().toISOString(),
        agentId: message.data?.agentId,
        sessionKey: message.data?.sessionKey,
        data: message.data || {},
      };
      addEvent(event);
    }
  };

  const sendMessage = (method: string, params?: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        reject(new Error("WebSocket not connected"));
        return;
      }

      const id = crypto.randomUUID();
      pendingRequests.current.set(id, { resolve, reject });

      // Set timeout
      setTimeout(() => {
        if (pendingRequests.current.has(id)) {
          pendingRequests.current.delete(id);
          reject(new Error("Request timeout"));
        }
      }, 30000);

      wsRef.current.send(JSON.stringify({ id, method, params }));
    });
  };

  const fetchInitialData = async () => {
    try {
      // Fetch sessions
      const sessionsResult = await sendMessage("sessions.list", { messageLimit: 0 });
      if (sessionsResult?.sessions) {
        setSessions(sessionsResult.sessions);

        // Derive agents from sessions
        const agentMap = new Map<string, any>();
        for (const session of sessionsResult.sessions) {
          const agentId = session.agentId || session.key.split(":")[1];
          if (!agentMap.has(agentId)) {
            agentMap.set(agentId, {
              id: agentId,
              name: agentId,
              status: "idle",
              model: session.model,
              lastActivity: session.lastActivity,
              activeSession: session.key,
              heartbeatNext: null,
              heartbeatOverdue: false,
            });
          }
        }
        setAgents(Array.from(agentMap.values()));
      }
    } catch (error) {
      console.error("Failed to fetch initial data:", error);
    }
  };

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <RealtimeContext.Provider value={{ sendMessage }}>
      {children}
    </RealtimeContext.Provider>
  );
}
