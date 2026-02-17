// Mission Control - Core Types

export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'completed' | 'blocked' | 'archived' | 'intake' | 'ready' | 'in_progress' | 'backlog' | 'paused';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskType = 'task' | 'feature' | 'bug' | 'research' | 'maintenance' | 'manual' | 'auto' | 'sync';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  type: TaskType;
  complexity: any;
  danger: any;
  assignedTo: string | null;
  list: string;
  tags: string[];
  metadata: any;
  dueDate: string | null;
  estimatedMinutes: number | null;
  actualMinutes?: number | null;
  parentId: string | null;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
  statusChangedAt: string;
  completedAt?: string | null;
  backburnered: boolean;
  [key: string]: any;
}

export interface Agent {
  id: string;
  name: string;
  creature: string;
  vibe: string;
  emoji: string;
  avatar?: string;
  enabled: boolean;
  status: any;
  lastActivity?: string;
  lastActivityAge?: string;
  sessions: number;
  [key: string]: any;
}

export interface Message {
  role: any;
  content: string;
  timestamp: string;
  tokens?: number;
  [key: string]: any;
}

export interface Session {
  key: string;
  kind: string;
  agentId: string;
  model: string;
  tokens: any;
  percentUsed: number;
  lastActivity: string;
  compactionCount: number;
  sessionId: string;
  flags: string[];
  canCompact: boolean;
  compactionStatus: any;
  [key: string]: any;
}

export type ConnectionStatus = any;

export interface Event {
  type: any;
  event: string;
  payload: any;
  [key: string]: any;
}

// Gateway Types (matching openclaw-gateway)
export interface ToolCall {
  id: string;
  tool: string;
  arguments: any;
  result?: any;
  error?: string;
}

export interface GatewayRequest {
  type: 'req';
  id: string;
  method: string;
  params: any;
  metadata?: any;
}

export interface GatewayResponse {
  type: 'res';
  id: string;
  ok: boolean;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface GatewayEvent {
  type: 'event';
  event: string;
  payload: any;
  data?: any;
  metadata?: any;
}

export interface CronJob {
  id: string;
  name: string;
  status: any;
  schedule: any;
  payload: any;
  sessionTarget: string;
  enabled: boolean;
  nextRun: string | null;
  lastRun?: any;
  [key: string]: any;
}

export interface TaskComplexity {
  id: number;
  label: string;
}

export interface TaskDanger {
  id: number;
  label: string;
}
