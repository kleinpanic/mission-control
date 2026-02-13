/**
 * Custom Next.js server with WebSocket proxy.
 *
 * When Mission Control is accessed from a non-localhost client (e.g., LAN),
 * the browser can't reach ws://127.0.0.1:18789 directly. This server proxies
 * WebSocket connections on /api/gateway/ws to the local gateway.
 */

import { createServer } from "http";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || process.env.MISSION_CONTROL_PORT || "3333", 10);
const hostname = "0.0.0.0";

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || "ws://127.0.0.1:18789";

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
        // Connect to the real gateway
        const gatewayWs = new WebSocket(GATEWAY_URL);
        let clientClosed = false;
        let gatewayClosed = false;

        gatewayWs.on("open", () => {
          console.log("[WS Proxy] Connected to gateway");
        });

        // Proxy: client -> gateway
        clientWs.on("message", (data) => {
          if (gatewayWs.readyState === WebSocket.OPEN) {
            gatewayWs.send(data);
          }
        });

        // Proxy: gateway -> client
        gatewayWs.on("message", (data) => {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(data);
          }
        });

        clientWs.on("close", () => {
          clientClosed = true;
          if (!gatewayClosed) {
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
          if (!gatewayClosed) gatewayWs.close();
        });

        gatewayWs.on("error", (err) => {
          console.error("[WS Proxy] Gateway error:", err.message);
          if (!clientClosed) clientWs.close();
        });
      });
    } else {
      // Let Next.js handle HMR WebSocket upgrades
      // Don't destroy the socket — Next.js dev server needs it
    }
  });

  server.listen(port, hostname, () => {
    console.log(`> Mission Control ready on http://${hostname}:${port}`);
    console.log(`> Gateway proxy: /api/gateway/ws -> ${GATEWAY_URL}`);
  });
});
