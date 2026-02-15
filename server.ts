/**
 * Custom Next.js server with WebSocket proxy.
 *
 * Security model:
 * - Clients authenticate to Mission Control with MISSION_CONTROL_PASSWORD
 * - Server proxies to gateway using OPENCLAW_GATEWAY_TOKEN (never sent to client)
 * - If no password is set, auth is disabled (local-only use)
 */

import { createServer } from "http";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";

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
      wss.handleUpgrade(req, socket, head, (clientWs) => {
        let gatewayWs: WebSocket | null = null;
        let clientClosed = false;
        let gatewayClosed = false;
        let clientAuthenticated = !MC_PASSWORD; // auto-auth if no password set
        let gatewayConnected = false;
        let pendingMessages: string[] = [];

        // Connect to the real gateway
        gatewayWs = new WebSocket(GATEWAY_URL, {
          headers: {
            Origin: req.headers.origin || req.headers.host || "http://localhost:3333"
          }
        });

        gatewayWs.on("open", () => {
          console.log("[WS Proxy] Connected to gateway");
          gatewayConnected = true;
          // Flush any pending messages
          for (const msg of pendingMessages) {
            gatewayWs!.send(msg);
          }
          pendingMessages = [];
        });

        // Proxy: client -> gateway
        // Intercept connect messages to inject the real gateway token
        clientWs.on("message", (data, isBinary) => {
          const raw = isBinary ? data : data.toString();
          const str = typeof raw === "string" ? raw : raw.toString();

          try {
            const msg = JSON.parse(str);

            // Intercept connect handshake — inject real gateway token
            if (msg.type === "req" && msg.method === "connect") {
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
                gatewayWs.send(rewritten);
              } else {
                pendingMessages.push(rewritten);
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
            pendingMessages.push(str);
          }
        });

        // Proxy: gateway -> client
        gatewayWs.on("message", (data, isBinary) => {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(data.toString(), { binary: false });
          }
        });

        clientWs.on("close", () => {
          clientClosed = true;
          if (!gatewayClosed && gatewayWs) {
            gatewayWs.close();
          }
          console.log("[WS Proxy] Client disconnected");
        });

        gatewayWs.on("close", () => {
          gatewayClosed = true;
          if (!clientClosed) {
            clientWs.close();
          }
          console.log("[WS Proxy] Gateway disconnected");
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
