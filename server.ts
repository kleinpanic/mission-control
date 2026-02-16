/**
 * Custom Next.js server with WebSocket proxy.
 * 
 * Architecture:
 * - Main HTTP server on port 3333 handles Next.js requests
 * - Standalone WebSocket proxy on port 9999 handles gateway connections
 * - This avoids conflicts between Next.js HTTP handling and WebSocket upgrades
 * 
 * Auth model:
 * - The proxy uses the gateway's device identity (ed25519 keypair) to authenticate
 *   with full operator.admin scopes. Without device identity, the gateway clears
 *   all scopes and WS actions (compact, reset, delete, wake, restart) all fail
 *   with "missing scope: operator.read/admin".
 * - The device identity is loaded from ~/.openclaw/identity/device.json
 * - The device auth token is loaded from ~/.openclaw/identity/device-auth.json
 * - On connect, the proxy sends the device object (id + publicKey) and the device
 *   token as auth.token, which the gateway verifies to grant scopes.
 */

import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";
import crypto from "crypto";

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

// ---------------------------------------------------------------------------
// Device Identity — required for gateway to grant operator scopes
// ---------------------------------------------------------------------------
interface DeviceIdentity {
  deviceId: string;
  publicKeyPem: string;
  privateKeyPem: string;
}
interface DeviceAuthToken {
  token: string;
  role: string;
  scopes: string[];
}

const OPENCLAW_HOME = process.env.OPENCLAW_STATE_DIR || resolve(process.env.HOME || "~", ".openclaw");
const DEVICE_IDENTITY_PATH = resolve(OPENCLAW_HOME, "identity/device.json");
const DEVICE_AUTH_PATH = resolve(OPENCLAW_HOME, "identity/device-auth.json");

let deviceIdentity: DeviceIdentity | null = null;
let deviceAuthToken: DeviceAuthToken | null = null;

try {
  const raw = readFileSync(DEVICE_IDENTITY_PATH, "utf8");
  const parsed = JSON.parse(raw);
  if (parsed?.version === 1 && parsed.deviceId && parsed.publicKeyPem && parsed.privateKeyPem) {
    deviceIdentity = {
      deviceId: parsed.deviceId,
      publicKeyPem: parsed.publicKeyPem,
      privateKeyPem: parsed.privateKeyPem,
    };
    console.log(`[Device] Loaded identity: ${parsed.deviceId.slice(0, 16)}...`);
  }
} catch (e: any) {
  console.warn(`[Device] Failed to load identity from ${DEVICE_IDENTITY_PATH}: ${e.message}`);
}

try {
  const raw = readFileSync(DEVICE_AUTH_PATH, "utf8");
  const parsed = JSON.parse(raw);
  const opToken = parsed?.tokens?.operator;
  if (opToken?.token) {
    deviceAuthToken = {
      token: opToken.token,
      role: opToken.role || "operator",
      scopes: opToken.scopes || [],
    };
    console.log(`[Device] Loaded auth token with scopes: ${deviceAuthToken.scopes.join(", ")}`);
  }
} catch (e: any) {
  console.warn(`[Device] Failed to load auth token from ${DEVICE_AUTH_PATH}: ${e.message}`);
}

/**
 * Convert PEM public key to raw base64url (what the gateway expects as device.publicKey).
 * Ed25519 SPKI DER = 12-byte prefix + 32-byte raw key.
 */
function publicKeyPemToBase64Url(pem: string): string {
  const keyObj = crypto.createPublicKey(pem);
  const spki = keyObj.export({ type: "spki", format: "der" });
  // Ed25519 SPKI prefix is 12 bytes (30 2a 30 05 06 03 2b 65 70 03 21 00)
  const ED25519_SPKI_PREFIX_LEN = 12;
  const raw = spki.length === ED25519_SPKI_PREFIX_LEN + 32
    ? spki.subarray(ED25519_SPKI_PREFIX_LEN)
    : spki;
  return raw.toString("base64url");
}

/**
 * Sign a payload with the device private key (ed25519).
 */
function signPayload(privateKeyPem: string, payload: string): string {
  const sign = crypto.sign(null, Buffer.from(payload), crypto.createPrivateKey(privateKeyPem));
  return sign.toString("base64url");
}

/**
 * Build the device auth payload string (must match gateway's buildDeviceAuthPayload exactly).
 * Format: version|deviceId|clientId|clientMode|role|scopes|signedAtMs|token[|nonce]
 */
function buildDeviceAuthPayload(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token: string | null;
  nonce?: string;
  version?: string;
}): string {
  const version = params.version ?? (params.nonce ? "v2" : "v1");
  const base = [
    version,
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    params.scopes.join(","),
    String(params.signedAtMs),
    params.token || "",
  ];
  if (version === "v2") base.push(params.nonce || "");
  return base.join("|");
}

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
  let connectNonce: string | null = null; // Captured from connect.challenge event

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
        // Log action responses (not connect) for debugging scope/auth issues
        if (msg.id && msg.id !== "connect" && msg.id !== "gateway-connect") {
          const ok = msg.ok ? "✓" : "✗";
          const detail = msg.ok ? "" : ` error="${msg.error?.message || ""}"`;
          console.log(`[WS Proxy] ← ${ok} ${msg.id.slice(0, 8)}${detail}`);
        }
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(str);
        }
        return;
      }

      // Filter events: only forward UI-relevant ones
      if (msg.type === "event") {
        const eventName: string = msg.event || "";

        // Capture nonce from connect.challenge for device auth signing
        if (eventName === "connect.challenge") {
          const payload = msg.payload;
          if (payload && typeof payload.nonce === "string") {
            connectNonce = payload.nonce;
          }
        }

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
        console.log("[WS Proxy] Rewriting connect handshake with device identity");
        
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

        // Build a proper connect message with device identity.
        // Without device identity, the gateway clears ALL scopes → every
        // action (compact, reset, wake, restart) fails with "missing scope".
        const scopes = ["operator.admin", "operator.read", "operator.approvals", "operator.pairing"];
        const clientId = "gateway-client"; // Must match GATEWAY_CLIENT_IDS
        const clientMode = "backend";      // Must match GATEWAY_CLIENT_MODES
        const role = "operator";
        const signedAtMs = Date.now();

        // Determine auth token: prefer device auth token, fall back to gateway token
        const authToken = deviceAuthToken?.token || GATEWAY_TOKEN;

        // Build device object if identity is available
        let device: any = undefined;
        if (deviceIdentity) {
          const publicKeyB64Url = publicKeyPemToBase64Url(deviceIdentity.publicKeyPem);
          // Use nonce from connect.challenge if available (required for non-local connections)
          const nonce = connectNonce || undefined;
          const version = nonce ? "v2" : "v1";
          const payload = buildDeviceAuthPayload({
            deviceId: deviceIdentity.deviceId,
            clientId,
            clientMode,
            role,
            scopes,
            signedAtMs,
            token: authToken,
            nonce,
            version,
          });
          const signature = signPayload(deviceIdentity.privateKeyPem, payload);
          device = {
            id: deviceIdentity.deviceId,
            publicKey: publicKeyB64Url,
            signature,
            signedAt: signedAtMs,
            nonce,
          };
        }

        const connectMsg = {
          type: "req",
          id: msg.id, // preserve original message ID so client gets the response
          method: "connect",
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
              id: clientId,
              displayName: "Mission Control Proxy",
              version: "1.2.0",
              platform: process.platform,
              mode: clientMode,
            },
            role,
            scopes,
            auth: { token: authToken },
            device,
          },
        };

        const rewritten = JSON.stringify(connectMsg);
        if (dev) console.log(`[WS Proxy] Connect with device=${!!device} scopes=${scopes.join(",")}`);
        if (gatewayConnected && gatewayWs.readyState === WebSocket.OPEN) {
          gatewayWs.send(rewritten);
        } else {
          pendingToGateway.push(rewritten);
        }
        return;
      }
    } catch {}

    // Pass through other messages (action requests like sessions.compact, wake, etc.)
    try {
      const parsed = JSON.parse(str);
      if (parsed.type === "req") {
        console.log(`[WS Proxy] Forwarding: ${parsed.method} (id=${parsed.id})`);
      }
    } catch {}
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
