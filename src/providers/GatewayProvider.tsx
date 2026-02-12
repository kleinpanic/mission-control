"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";
import { useRealtimeStore } from "@/stores/realtime";
import { Event } from "@/types";

interface GatewayContextType {
  connected: boolean;
  connecting: boolean;
  request: <T = any>(method: string, params?: Record<string, any>) => Promise<T>;
  subscribe: (event: string, handler: (payload: any) => void) => () => void;
}

const GatewayContext = createContext<GatewayContextType | null>(null);

export function useGateway() {
  const context = useContext(GatewayContext);
  if (!context) {
    throw new Error("useGateway must be used within GatewayProvider");
  }
  return context;
}

interface Props {
  children: ReactNode;
}

export function GatewayProvider({ children }: Props) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef<Map<string, { resolve: (value: any) => void; reject: (error: any) => void; timer: NodeJS.Timeout }>>(new Map());
  const subscribersRef = useRef<Map<string, Set<(payload: any) => void>>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 15;
  const isConnecting = useRef(false);
  
  const { setConnectionStatus, addEvent } = useRealtimeStore();

  const handleMessage = useCallback((data: string) => {
    try {
      const msg = JSON.parse(data);
      
      // Handle connect challenge - gateway sends this on connection
      if (msg.type === "event" && msg.event === "connect.challenge") {
        console.log("[Gateway] Received connect.challenge, sending handshake...");
        wsRef.current?.send(JSON.stringify({
          type: "req",
          id: "connect",
          method: "connect",
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
              id: "openclaw-control-ui",
              version: "1.0.0",
              platform: "web",
              mode: "ui"
            },
            role: "operator",
            scopes: ["operator.read", "operator.write"],
            auth: { token: process.env.NEXT_PUBLIC_GATEWAY_TOKEN || "" }
          }
        }));
        return;
      }
      
      // Handle responses
      if (msg.type === "res") {
        // Handle connect response
        if (msg.id === "connect") {
          if (msg.ok) {
            console.log("[Gateway] Connected successfully!");
            setConnected(true);
            setConnecting(false);
            setConnectionStatus("connected");
            reconnectAttempts.current = 0;
          } else {
            console.error("[Gateway] Connection rejected:", msg.error);
            setConnectionStatus("error", msg.error?.message || "Connection rejected");
          }
          return;
        }
        
        // Handle other pending requests
        const pending = pendingRef.current.get(msg.id);
        if (pending) {
          clearTimeout(pending.timer);
          pendingRef.current.delete(msg.id);
          
          if (msg.ok) {
            pending.resolve(msg.payload);
          } else {
            pending.reject(new Error(msg.error?.message || "Request failed"));
          }
        }
        return;
      }
      
      // Handle events
      if (msg.type === "event") {
        const eventName = msg.event;
        const payload = msg.payload || {};
        
        // Notify subscribers
        const subs = subscribersRef.current.get(eventName);
        if (subs) {
          subs.forEach(handler => {
            try {
              handler(payload);
            } catch (e) {
              console.error(`[Gateway] Subscriber error for ${eventName}:`, e);
            }
          });
        }
        
        // Also notify wildcard subscribers
        const wildcardSubs = subscribersRef.current.get("*");
        if (wildcardSubs) {
          wildcardSubs.forEach(handler => {
            try {
              handler({ event: eventName, ...payload });
            } catch (e) {
              console.error(`[Gateway] Wildcard subscriber error:`, e);
            }
          });
        }
        
        // Add to realtime store for Recent Activity
        const event: Event = {
          type: eventName as any,
          timestamp: new Date().toISOString(),
          agentId: payload.agentId,
          sessionKey: payload.sessionKey,
          data: payload,
        };
        addEvent(event);
        
        return;
      }
    } catch (e) {
      console.error("[Gateway] Failed to parse message:", e);
    }
  }, [setConnectionStatus, addEvent]);

  const connect = useCallback(() => {
    if (isConnecting.current || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }
    
    isConnecting.current = true;
    setConnecting(true);
    setConnectionStatus("connecting");
    
    console.log("[Gateway] Connecting to ws://127.0.0.1:18789...");
    
    try {
      const ws = new WebSocket("ws://127.0.0.1:18789");
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log("[Gateway] WebSocket opened, waiting for challenge...");
        // Don't set connected yet - wait for successful handshake
      };
      
      ws.onmessage = (event) => {
        handleMessage(event.data);
      };
      
      ws.onerror = (error) => {
        console.error("[Gateway] WebSocket error:", error);
        setConnectionStatus("error", "Connection error");
      };
      
      ws.onclose = (event) => {
        console.log(`[Gateway] WebSocket closed: code=${event.code}, reason=${event.reason}`);
        isConnecting.current = false;
        setConnected(false);
        setConnecting(false);
        setConnectionStatus("disconnected");
        wsRef.current = null;
        
        // Clear all pending requests
        pendingRef.current.forEach(({ reject, timer }) => {
          clearTimeout(timer);
          reject(new Error("Connection closed"));
        });
        pendingRef.current.clear();
        
        // Auto-reconnect with exponential backoff
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts.current), 30000);
          reconnectAttempts.current++;
          console.log(`[Gateway] Reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        } else {
          console.error("[Gateway] Max reconnection attempts reached");
        }
      };
    } catch (e) {
      console.error("[Gateway] Failed to create WebSocket:", e);
      isConnecting.current = false;
      setConnecting(false);
      setConnectionStatus("error", "Failed to connect");
    }
  }, [handleMessage, setConnectionStatus]);

  const request = useCallback(<T = any>(method: string, params: Record<string, any> = {}): Promise<T> => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !connected) {
        reject(new Error("Not connected to gateway"));
        return;
      }
      
      const id = crypto.randomUUID();
      
      // Set timeout (30 seconds)
      const timer = setTimeout(() => {
        if (pendingRef.current.has(id)) {
          pendingRef.current.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 30000);
      
      pendingRef.current.set(id, { resolve, reject, timer });
      
      const message = JSON.stringify({
        type: "req",
        id,
        method,
        params
      });
      
      wsRef.current.send(message);
    });
  }, [connected]);

  const subscribe = useCallback((event: string, handler: (payload: any) => void): () => void => {
    if (!subscribersRef.current.has(event)) {
      subscribersRef.current.set(event, new Set());
    }
    subscribersRef.current.get(event)!.add(handler);
    
    // Return unsubscribe function
    return () => {
      subscribersRef.current.get(event)?.delete(handler);
    };
  }, []);

  useEffect(() => {
    connect();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      // Clear pending requests
      pendingRef.current.forEach(({ timer }) => clearTimeout(timer));
      pendingRef.current.clear();
    };
  }, [connect]);

  const value: GatewayContextType = {
    connected,
    connecting,
    request,
    subscribe,
  };

  return (
    <GatewayContext.Provider value={value}>
      {children}
    </GatewayContext.Provider>
  );
}
