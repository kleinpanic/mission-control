// Mission Control - OpenClaw Gateway WebSocket Client
import WebSocket from 'ws';
import { GatewayRequest, GatewayResponse, GatewayEvent, ConnectionStatus } from '@/types';

type RequestCallback = (response: GatewayResponse) => void;
type EventCallback = (event: GatewayEvent) => void;

export class GatewayClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 1000;
  private connected: boolean = false;
  private requestCallbacks: Map<string, RequestCallback> = new Map();
  private eventCallbacks: Set<EventCallback> = new Set();
  private statusCallback: ((status: ConnectionStatus, error?: string) => void) | null = null;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.setStatus('connecting');

      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        this.setStatus('connected');

        // Send auth
        this.send({
          id: crypto.randomUUID(),
          method: 'authenticate',
          params: { token: this.token },
        });

        // Start ping interval
        this.startPing();

        resolve();
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      });

      this.ws.on('error', (error: Error) => {
        console.error('WebSocket error:', error);
        this.setStatus('error', error.message);
        reject(error);
      });

      this.ws.on('close', () => {
        this.connected = false;
        this.stopPing();
        this.setStatus('disconnected');

        // Auto-reconnect
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
          console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
          setTimeout(() => this.connect().catch(console.error), delay);
        }
      });
    });
  }

  disconnect() {
    this.stopPing();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.setStatus('disconnected');
  }

  send(request: GatewayRequest): Promise<GatewayResponse> {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.ws) {
        reject(new Error('Not connected to gateway'));
        return;
      }

      this.requestCallbacks.set(request.id, resolve);

      try {
        this.ws.send(JSON.stringify(request));
      } catch (error) {
        this.requestCallbacks.delete(request.id);
        reject(error);
      }

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.requestCallbacks.has(request.id)) {
          this.requestCallbacks.delete(request.id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  subscribe(callback: EventCallback) {
    this.eventCallbacks.add(callback);
  }

  unsubscribe(callback: EventCallback) {
    this.eventCallbacks.delete(callback);
  }

  onStatus(callback: (status: ConnectionStatus, error?: string) => void) {
    this.statusCallback = callback;
  }

  private handleMessage(message: any) {
    // Check if it's a response to a request
    if (message.id && this.requestCallbacks.has(message.id)) {
      const callback = this.requestCallbacks.get(message.id)!;
      this.requestCallbacks.delete(message.id);
      callback(message as GatewayResponse);
      return;
    }

    // Check if it's an event
    if (message.type) {
      const event: GatewayEvent = {
        type: message.type,
        data: message.data || {},
      };
      this.eventCallbacks.forEach((callback) => callback(event));
      return;
    }
  }

  private setStatus(status: ConnectionStatus, error?: string) {
    if (this.statusCallback) {
      this.statusCallback(status, error);
    }
  }

  private startPing() {
    this.pingInterval = setInterval(() => {
      if (this.connected && this.ws) {
        this.send({
          id: crypto.randomUUID(),
          method: 'ping',
        }).catch(console.error);
      }
    }, 30000); // Ping every 30 seconds
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // ===== High-level API Methods =====

  async listSessions(params?: { kinds?: string[]; limit?: number; messageLimit?: number }) {
    const response = await this.send({
      id: crypto.randomUUID(),
      method: 'sessions.list',
      params,
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    return response.result;
  }

  async getSessionHistory(sessionKey: string, limit?: number) {
    const response = await this.send({
      id: crypto.randomUUID(),
      method: 'sessions.history',
      params: { sessionKey, limit, includeTools: true },
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    return response.result;
  }

  async sendToSession(sessionKey: string, message: string) {
    const response = await this.send({
      id: crypto.randomUUID(),
      method: 'sessions.send',
      params: { sessionKey, message },
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    return response.result;
  }

  async getSessionStatus(sessionKey: string) {
    const response = await this.send({
      id: crypto.randomUUID(),
      method: 'session.status',
      params: { sessionKey },
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    return response.result;
  }

  async listCronJobs() {
    const response = await this.send({
      id: crypto.randomUUID(),
      method: 'cron.list',
      params: {},
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    return response.result;
  }

  async getCronStatus() {
    const response = await this.send({
      id: crypto.randomUUID(),
      method: 'cron.status',
      params: {},
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    return response.result;
  }

  async runCronJob(jobId: string) {
    const response = await this.send({
      id: crypto.randomUUID(),
      method: 'cron.run',
      params: { jobId, runMode: 'force' },
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    return response.result;
  }

  async getCronRuns(jobId: string) {
    const response = await this.send({
      id: crypto.randomUUID(),
      method: 'cron.runs',
      params: { jobId },
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    return response.result;
  }
}

// Singleton instance
let gatewayClient: GatewayClient | null = null;

export function getGatewayClient(): GatewayClient {
  if (!gatewayClient) {
    const url = process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789';
    const token = process.env.OPENCLAW_GATEWAY_TOKEN || '';
    gatewayClient = new GatewayClient(url, token);
  }
  return gatewayClient;
}
