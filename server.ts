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
import { handleSlackMessage } from "./src/lib/slack-tasks-debug";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || process.env.MISSION_CONTROL_PORT || "3333", 10);
const wsProxyPort = parseInt(process.env.WS_PROXY_PORT || "9999", 10);
const hostname = "0.0.0.0";

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || "ws://127.0.0.1:18789";
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || "";
const MC_PASSWORD = process.env.MISSION_CONTROL_PASSWORD || "";
const ALLOWED_ORIGIN = `http://localhost:${port}`;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

/**
 * Create a WebSocket proxy connection handler.
 * Bridges browser clients to the OpenClaw gateway.
 */
function handleWsProxyConnection(clientWs: WebSocket, req: { headers: { origin?: string; host?: string } }) {
  console.log("[WS Proxy] Client connected from:", req.headers.origin || "unknown");
  
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
    console.log("[WS Proxy] Gateway connected (Origin:", ALLOWED_ORIGIN + ")");
    gatewayConnected = true;
    for (const msg of pendingToGateway) {
      gatewayWs.send(msg);
    }
    pendingToGateway = [];
  });

  // Gateway -> Client
  gatewayWs.on("message", (data) => {
    const str = data.toString();
    console.log("[WS Proxy] Gateway ->", str.substring(0, 80));
    
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(str);
    }

    // Slack integration: auto-create tasks from Slack messages
    try {
      const msg = JSON.parse(str);
      if (msg.type === "event" && msg.event === "message.channel") {
        handleSlackMessage(msg.payload);
      }
    } catch {}
  });

  // Client -> Gateway
  clientWs.on("message", (data) => {
    const str = data.toString();
    console.log("[WS Proxy] Client ->", str.substring(0, 80));

    try {
      const msg = JSON.parse(str);

      if (msg.type === "req" && msg.method === "connect") {
        console.log("[WS Proxy] Intercepting connect, injecting token");
        
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
    console.log("[WS Proxy] Client closed:", code);
    if (!gatewayClosed) gatewayWs.close();
  });

  gatewayWs.on("close", (code) => {
    gatewayClosed = true;
    console.log("[WS Proxy] Gateway closed:", code);
    if (!clientClosed && clientWs.readyState === WebSocket.OPEN) clientWs.close();
  });

  clientWs.on("error", (e) => {
    console.error("[WS Proxy] Client error:", e.message);
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
