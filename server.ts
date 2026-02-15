/**
 * Custom Next.js server with WebSocket proxy.
 *
 * Security model:
 * - Clients authenticate to Mission Control with MISSION_CONTROL_PASSWORD
 * - Server proxies to gateway using OPENCLAW_GATEWAY_TOKEN (never sent to client)
 * - If no password is set, auth is disabled (local-only use)
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local before anything else (tsx doesn't auto-load Next.js env files)
config({ path: resolve(process.cwd(), ".env.local"), override: true });
config({ path: resolve(process.cwd(), ".env") });

import { createServer } from "http";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";
import { handleSlackMessage } from "./src/lib/slack-tasks-debug";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || process.env.MISSION_CONTROL_PORT || "3333", 10);
const hostname = "0.0.0.0";

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || "ws://127.0.0.1:18789";
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || "";
const MC_PASSWORD = process.env.MISSION_CONTROL_PASSWORD || "";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res);
  });

  // WebSocket proxy for gateway connections
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = new URL(req.url || "/", `http://${req.headers.host}`);

    if (pathname === "/api/gateway/ws") {
      console.log("[WS Proxy] Client upgrade request received");
      
      wss.handleUpgrade(req, socket, head, (clientWs) => {
        console.log("[WS Proxy] Client WebSocket created, readyState:", clientWs.readyState);
        
        let gatewayWs: WebSocket | null = null;
        let clientClosed = false;
        let gatewayClosed = false;
        let clientAuthenticated = !MC_PASSWORD; // auto-auth if no password set
        let gatewayConnected = false;
        let pendingToClient: string[] = []; // Messages from gateway waiting for client
        let pendingToGateway: string[] = []; // Messages from client waiting for gateway

        // Connect to the real gateway
        gatewayWs = new WebSocket(GATEWAY_URL, {
          headers: {
            Origin: req.headers.origin || req.headers.host || "http://localhost:3333"
          }
        });

        gatewayWs.on("open", () => {
          console.log("[WS Proxy] Connected to gateway");
          gatewayConnected = true;
          
          // Flush any pending messages to gateway
          if (pendingToGateway.length > 0) {
            console.log("[WS Proxy] Flushing", pendingToGateway.length, "pending messages to gateway");
            for (const msg of pendingToGateway) {
              gatewayWs!.send(msg);
            }
            pendingToGateway = [];
          }
        });

        // Helper to safely send to client with buffering
        const sendToClient = (data: string) => {
          console.log("[WS Proxy] Sending to client, readyState:", clientWs.readyState);
          
          if (clientWs.readyState === WebSocket.OPEN) {
            try {
              clientWs.send(data);
              console.log("[WS Proxy] Message sent to client successfully");
            } catch (e: any) {
              console.error("[WS Proxy] Error sending to client:", e.message);
            }
          } else if (clientWs.readyState === WebSocket.CONNECTING) {
            console.log("[WS Proxy] Client still connecting, buffering message");
            pendingToClient.push(data);
          } else {
            console.log("[WS Proxy] Client not open (state:", clientWs.readyState, "), dropping message");
          }
        };

        // Flush buffered messages when client is ready
        // The 'open' event on the server side of ws fires when handleUpgrade completes
        // but the browser might not be fully ready yet - use setImmediate to ensure
        // the JavaScript event loop has completed
        setImmediate(() => {
          if (pendingToClient.length > 0 && clientWs.readyState === WebSocket.OPEN) {
            console.log("[WS Proxy] Flushing", pendingToClient.length, "buffered messages to client");
            for (const msg of pendingToClient) {
              try {
                clientWs.send(msg);
              } catch (e: any) {
                console.error("[WS Proxy] Error flushing to client:", e.message);
              }
            }
            pendingToClient = [];
          }
        });

        // Proxy: client -> gateway
        // Intercept connect messages to inject the real gateway token
        clientWs.on("message", (data, isBinary) => {
          const raw = isBinary ? data : data.toString();
          const str = typeof raw === "string" ? raw : raw.toString();
          console.log("[WS Proxy] Client message:", str.substring(0, 100));

          try {
            const msg = JSON.parse(str);

            // Intercept connect handshake — inject real gateway token
            if (msg.type === "req" && msg.method === "connect") {
              console.log("[WS Proxy] Intercepting connect request, injecting token");
              
              // Check MC password if configured
              if (MC_PASSWORD && !clientAuthenticated) {
                const clientPassword = msg.params?.auth?.mcPassword || msg.params?.auth?.password || "";
                if (clientPassword !== MC_PASSWORD) {
                  clientWs.send(JSON.stringify({
                    type: "res",
                    id: msg.id,
                    ok: false,
                    error: { code: 401, message: "Invalid Mission Control password" }
                  }));
                  clientWs.close(4001, "Authentication failed");
                  return;
                }
                clientAuthenticated = true;
              }

              // Replace client auth with real gateway token
              if (!msg.params) msg.params = {};
              if (!msg.params.auth) msg.params.auth = {};
              msg.params.auth.token = GATEWAY_TOKEN;
              // Remove MC-specific auth fields
              delete msg.params.auth.mcPassword;
              delete msg.params.auth.password;

              const rewritten = JSON.stringify(msg);
              if (gatewayConnected && gatewayWs?.readyState === WebSocket.OPEN) {
                console.log("[WS Proxy] Forwarding connect to gateway with token");
                gatewayWs.send(rewritten);
              } else {
                console.log("[WS Proxy] Gateway not ready, queueing connect request");
                pendingToGateway.push(rewritten);
              }
              return;
            }
          } catch {
            // Not JSON, pass through
          }

          // Pass through all other messages
          if (!clientAuthenticated) {
            clientWs.send(JSON.stringify({
              type: "res",
              id: "auth-required",
              ok: false,
              error: { code: 401, message: "Authentication required" }
            }));
            return;
          }

          if (gatewayConnected && gatewayWs?.readyState === WebSocket.OPEN) {
            gatewayWs.send(str);
          } else {
            pendingToGateway.push(str);
          }
        });

        // Proxy: gateway -> client
        gatewayWs.on("message", (data, isBinary) => {
          const str = data.toString();
          console.log("[WS Proxy] Gateway message:", str.substring(0, 100));
          
          // Try to identify the message type
          try {
            const msg = JSON.parse(str);
            if (msg.type === "event" && msg.event === "connect.challenge") {
              console.log("[WS Proxy] Forwarding connect.challenge to client");
            }
          } catch {
            // ignore
          }
          
          sendToClient(str);

          // Slack -> Kanban Integration
          try {
            const msg = JSON.parse(str);
            if (msg.type === "event" && msg.event === "message.channel") {
              handleSlackMessage(msg.payload);
            }
          } catch (e) {
            // Not JSON or other error, ignore
          }
        });

        clientWs.on("close", (code, reason) => {
          clientClosed = true;
          console.log(`[WS Proxy] Client disconnected: code=${code}, reason=${reason}`);
          if (!gatewayClosed && gatewayWs) {
            gatewayWs.close();
          }
        });

        gatewayWs.on("close", (code, reason) => {
          gatewayClosed = true;
          console.log(`[WS Proxy] Gateway disconnected: code=${code}, reason=${reason}`);
          if (!clientClosed) {
            clientWs.close();
          }
        });

        clientWs.on("error", (err) => {
          console.error("[WS Proxy] Client error:", err.message);
          if (!gatewayClosed && gatewayWs) gatewayWs.close();
        });

        gatewayWs.on("error", (err) => {
          console.error("[WS Proxy] Gateway error:", err.message);
          if (!clientClosed) clientWs.close();
        });
      });
    } else {
      // Let Next.js handle HMR WebSocket upgrades
    }
  });

  server.listen(port, hostname, () => {
    console.log(`> Mission Control ready on http://${hostname}:${port}`);
    console.log(`> Gateway proxy: /api/gateway/ws -> ${GATEWAY_URL}`);
    console.log(`> Auth: ${MC_PASSWORD ? "Password required" : "No password (local only)"}`);
  });
});
