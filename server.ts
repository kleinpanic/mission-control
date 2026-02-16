/**
 * Custom Next.js server with WebSocket proxy.
 * 
 * Architecture:
 * - Main HTTP server on port 3333 handles Next.js requests
 * - Standalone WebSocket proxy on port 9999 handles gateway connections
 * - This avoids conflicts between Next.js HTTP handling and WebSocket upgrades
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local"), override: true });
config({ path: resolve(process.cwd(), ".env") });

import { createServer } from "http";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";
import { EventEmitter } from "events";
import { handleSlackMessage } from "./src/lib/slack-tasks-debug";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || process.env.MISSION_CONTROL_PORT || "3333", 10);
const wsProxyPort = parseInt(process.env.WS_PROXY_PORT || "9999", 10);
const hostname = "0.0.0.0";

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || "ws://127.0.0.1:18789";
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || "";
const MC_PASSWORD = process.env.MISSION_CONTROL_PASSWORD || "";
const ALLOWED_ORIGIN = `http://localhost:${port}`;

// Clean up stale dev lock to prevent restart loops
import { existsSync, unlinkSync } from "fs";
const lockFile = resolve(process.cwd(), ".next/dev/lock");
if (existsSync(lockFile)) {
  try { unlinkSync(lockFile); } catch {}
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Internal event bus for broadcasting custom events to WebSocket clients
export const broadcastEmitter = new EventEmitter();

// Track all connected WebSocket clients for broadcasting
const connectedClients = new Set<WebSocket>();

/**
 * Broadcast a custom event to all connected WebSocket clients.
 * Called by API routes to push real-time updates.
 */
export function broadcastToClients(event: string, payload: any) {
  const message = JSON.stringify({
    type: "event",
    event,
    payload,
  });

  if (dev) console.log(`[Broadcast] ${event} → ${connectedClients.size} clients`);

  connectedClients.forEach((clientWs) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      try {
        clientWs.send(message);
      } catch (error) {
        console.error("[Broadcast] Failed to send to client:", error);
      }
    }
  });
}

// Attach to global for access from API routes
(global as any).broadcastToClients = broadcastToClients;

/**
 * Create a WebSocket proxy connection handler.
 * Bridges browser clients to the OpenClaw gateway.
 */
function handleWsProxyConnection(clientWs: WebSocket, req: { headers: { origin?: string; host?: string } }) {
  // Add to connected clients set
  connectedClients.add(clientWs);
  if (dev) console.log(`[WS Proxy] Client connected (${connectedClients.size} total)`);
  
  let gatewayClosed = false;
  let clientClosed = false;
  let gatewayConnected = false;
  let pendingToGateway: string[] = [];

  // Connect to gateway with proper Origin header
  const gatewayWs = new WebSocket(GATEWAY_URL, {
    headers: {
      Origin: ALLOWED_ORIGIN
    }
  });

  gatewayWs.on("open", () => {
    if (dev) console.log("[WS Proxy] Gateway connected");
    gatewayConnected = true;
    for (const msg of pendingToGateway) {
      gatewayWs.send(msg);
    }
    pendingToGateway = [];
  });

  // Events the UI actually subscribes to — everything else is dropped.
  // This prevents the browser from drowning in agent.thinking / chat stream events.
  const UI_RELEVANT_EVENTS = new Set([
    "connect.challenge",
    "agent",           // agent run start/end (dashboard, sessions)
    "session",         // session lifecycle (sessions page)
    "cron",            // cron state changes (cron page)
    "cron.run",
    "task",            // task mutations (kanban)
    "task.update",
    "approval",        // approvals page
    "cost",            // cost events (dashboard)
    "message.channel", // Slack integration
    "health",          // connection keepalive
  ]);

  // Rate-limit: max 1 event per type per 500ms to prevent render floods
  const lastEventTime = new Map<string, number>();
  const EVENT_THROTTLE_MS = 500;

  // Gateway -> Client (with filtering + throttling)
  gatewayWs.on("message", (data) => {
    const str = data.toString();

    try {
      const msg = JSON.parse(str);

      // Always forward responses (req/res pairs)
      if (msg.type === "res") {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(str);
        }
        return;
      }

      // Filter events: only forward UI-relevant ones
      if (msg.type === "event") {
        const eventName: string = msg.event || "";

        // Slack integration hook (runs regardless of forwarding)
        if (eventName === "message.channel") {
          handleSlackMessage(msg.payload);
        }

        // Drop events the UI doesn't care about
        if (!UI_RELEVANT_EVENTS.has(eventName)) {
          return;
        }

        // Throttle: skip duplicate event types within the cooldown window
        const now = Date.now();
        const lastSent = lastEventTime.get(eventName) || 0;
        if (now - lastSent < EVENT_THROTTLE_MS && eventName !== "connect.challenge") {
          return;
        }
        lastEventTime.set(eventName, now);

        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(str);
        }
        return;
      }

      // Unknown message types: forward as-is (safety net)
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(str);
      }
    } catch {
      // Not valid JSON — forward raw
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(str);
      }
    }
  });

  // Client -> Gateway
  clientWs.on("message", (data) => {
    const str = data.toString();

    try {
      const msg = JSON.parse(str);

      if (msg.type === "req" && msg.method === "connect") {
        if (dev) console.log("[WS Proxy] Injecting gateway token");
        
        // Check MC password if configured
        if (MC_PASSWORD) {
          const pw = msg.params?.auth?.mcPassword || msg.params?.auth?.password || "";
          if (pw !== MC_PASSWORD) {
            clientWs.send(JSON.stringify({
              type: "res", id: msg.id, ok: false,
              error: { code: 401, message: "Invalid password" }
            }));
            clientWs.close(4001, "Auth failed");
            return;
          }
        }

        // Inject gateway token
        if (!msg.params) msg.params = {};
        if (!msg.params.auth) msg.params.auth = {};
        msg.params.auth.token = GATEWAY_TOKEN;
        delete msg.params.auth.mcPassword;
        delete msg.params.auth.password;

        const rewritten = JSON.stringify(msg);
        if (gatewayConnected && gatewayWs.readyState === WebSocket.OPEN) {
          gatewayWs.send(rewritten);
        } else {
          pendingToGateway.push(rewritten);
        }
        return;
      }
    } catch {}

    // Pass through other messages
    if (gatewayConnected && gatewayWs.readyState === WebSocket.OPEN) {
      gatewayWs.send(str);
    } else {
      pendingToGateway.push(str);
    }
  });

  clientWs.on("close", (code) => {
    clientClosed = true;
    connectedClients.delete(clientWs);
    if (dev) console.log(`[WS Proxy] Client closed: ${code} (${connectedClients.size} remaining)`);
    if (!gatewayClosed) gatewayWs.close();
  });

  gatewayWs.on("close", (code) => {
    gatewayClosed = true;
    if (dev) console.log("[WS Proxy] Gateway closed:", code);
    if (!clientClosed && clientWs.readyState === WebSocket.OPEN) clientWs.close();
  });

  clientWs.on("error", (e) => {
    console.error("[WS Proxy] Client error:", e.message);
    connectedClients.delete(clientWs);
    if (!gatewayClosed) gatewayWs.close();
  });

  gatewayWs.on("error", (e) => {
    console.error("[WS Proxy] Gateway error:", e.message);
    if (!clientClosed && clientWs.readyState === WebSocket.OPEN) clientWs.close();
  });
}

app.prepare().then(() => {
  // Main HTTP server for Next.js
  const server = createServer((req, res) => {
    handle(req, res);
  });

  // Standalone WebSocket proxy server on separate port
  // This avoids Next.js HTTP/WebSocket conflicts
  const wsProxyServer = createServer((req, res) => {
    res.writeHead(200);
    res.end("WebSocket proxy server");
  });

  const wss = new WebSocketServer({ server: wsProxyServer });

  wss.on("connection", (clientWs, req) => {
    handleWsProxyConnection(clientWs, req);
  });

  // Start WebSocket proxy first
  wsProxyServer.listen(wsProxyPort, hostname, () => {
    console.log(`> WebSocket proxy on ws://${hostname}:${wsProxyPort}`);
    console.log(`> Forwarding to gateway: ${GATEWAY_URL}`);
  });

  // Then start main server
  server.listen(port, hostname, () => {
    console.log(`> Mission Control ready on http://${hostname}:${port}`);
    console.log(`> Auth: ${MC_PASSWORD ? "Password required" : "No password"}`);
  });
});
