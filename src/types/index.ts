// Mission Control - TypeScript Type Definitions

// ===== Agent Types =====

export type AgentStatus = 'active' | 'idle' | 'waiting' | 'error';

export interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  model: string | null;
  authMode?: string; // "oauth" | "api" | "token" | "local" | "unknown"
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
  kind?: 'direct' | 'group' | 'isolated';
  agentId?: string;
  model?: string;
  tokens?: {
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
  lastActivity?: string;
  compactions?: number;
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
  arguments: Record<string, unknown>;
  result?: unknown;
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

// ===== Task Types (Kanban — shared with oc-tasks) =====

export type TaskStatus = 'intake' | 'ready' | 'backlog' | 'in_progress' | 'review' | 'paused' | 'blocked' | 'completed' | 'archived';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type TaskComplexity = 'trivial' | 'simple' | 'moderate' | 'complex' | 'epic';
export type TaskDanger = 'safe' | 'low' | 'medium' | 'high' | 'critical';
export type TaskType = 'manual' | 'auto' | 'sync';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  complexity?: TaskComplexity;
  danger?: TaskDanger;
  type: TaskType;
  assignedTo: string | null;
  list?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  statusChangedAt?: string;
  tags: string[];
  metadata?: Record<string, unknown>;
  detailScore?: number;
  minDetailRequired?: number;
  autoBackburnered?: boolean;
  slaBreached?: boolean;
  blockedBy?: string[];
  blockerDescription?: string;
  dueDate?: string | null;
  estimatedMinutes?: number | null;
  actualMinutes?: number;
  parentId?: string | null;
  projectId?: string | null;
  source?: string;
  recommendedModel?: string | null;
  reminderId?: string | null;
  reminderList?: string | null;
  reminderSyncedAt?: string | null;
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
  data: Record<string, unknown>;
}

// ===== Gateway Types =====

export interface GatewayRequest {
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

export interface GatewayResponse {
  id: string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface GatewayEvent {
  type: EventType;
  data: Record<string, unknown>;
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
