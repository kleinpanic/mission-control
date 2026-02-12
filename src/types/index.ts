// Mission Control - TypeScript Type Definitions

// ===== Agent Types =====

export type AgentStatus = 'active' | 'idle' | 'waiting' | 'error';

export interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  model: string | null;
  lastActivity: string | null;
  activeSession: string | null;
  heartbeatNext: string | null;
  heartbeatOverdue: boolean;
  activeSessions?: number;
  tokenLimited?: boolean;
  rateLimited?: boolean;
  contextUsagePercent?: number;
}

// ===== Session Types =====

export interface Session {
  key: string;
  kind: 'direct' | 'group' | 'isolated';
  agentId: string;
  model: string;
  tokens: {
    used: number;
    limit: number;
    input?: number;
    output?: number;
    cached?: number;
  };
  cost?: {
    input: number;
    output: number;
    total: number;
  };
  lastActivity: string;
  compactions: number;
  thinking?: string;
  startedAt?: string;
  messages?: Message[];
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  name: string;
  arguments: Record<string, any>;
  result?: any;
}

// ===== Cron Types =====

export type CronJobStatus = 'active' | 'disabled' | 'error';

export interface CronJob {
  id: string;
  name: string;
  status: CronJobStatus;
  schedule: {
    kind: 'at' | 'every' | 'cron';
    expr?: string;
    everyMs?: number;
    anchorMs?: number;
    at?: string;
    tz?: string;
  };
  payload: {
    kind: 'systemEvent' | 'agentTurn';
    text?: string;
    message?: string;
  };
  sessionTarget: 'main' | 'isolated';
  nextRun: string | null;
  lastRun?: {
    timestamp: string;
    status: 'success' | 'failure';
    error?: string;
  };
  enabled: boolean;
}

// ===== Task Types (Kanban) =====

export type TaskStatus = 'queue' | 'inProgress' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskType = 'manual' | 'auto';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  type: TaskType;
  assignedTo: string | null; // agentId
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  tags: string[];
  metadata?: Record<string, any>;
}

// ===== Cost Types =====

export interface CostData {
  provider: string;
  model: string;
  input: {
    tokens: number;
    cost: number;
  };
  output: {
    tokens: number;
    cost: number;
  };
  total: {
    tokens: number;
    cost: number;
  };
  timestamp: string;
}

export interface CostSummary {
  today: number;
  week: number;
  month: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
}

// ===== Event Types =====

export type EventType =
  | 'agent.run.start'
  | 'agent.run.end'
  | 'session.message'
  | 'cron.job.run'
  | 'cron.job.end'
  | 'session.created'
  | 'session.ended'
  | 'error';

export interface Event {
  type: EventType;
  timestamp: string;
  agentId?: string;
  sessionKey?: string;
  data: Record<string, any>;
}

// ===== Gateway Types =====

export interface GatewayRequest {
  id: string;
  method: string;
  params?: Record<string, any>;
}

export interface GatewayResponse {
  id: string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface GatewayEvent {
  type: EventType;
  data: Record<string, any>;
}

// ===== Dashboard Types =====

export interface DashboardStats {
  activeAgents: number;
  totalSessions: number;
  todayCost: number;
  nextHeartbeat: {
    agentId: string;
    time: string;
  } | null;
  recentEvents: Event[];
  quickStats: {
    tokensToday: number;
    mostActiveAgent: string | null;
    cronJobsToday: number;
    errorsToday: number;
  };
}

// ===== WebSocket Connection Types =====

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface ConnectionState {
  status: ConnectionStatus;
  error?: string;
  reconnectAttempts: number;
  lastPing?: string;
}
