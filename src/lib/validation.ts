// Mission Control - Request Validation Schemas
import { z } from 'zod';

export const TaskStatusSchema = z.enum([
  'intake',
  'ready',
  'in_progress',
  'review',
  'completed',
  'backlog',
  'paused',
  'blocked',
  'archived',
]);

export const TaskPrioritySchema = z.enum([
  'critical',
  'high',
  'medium',
  'low',
]);

export const TaskComplexitySchema = z.enum([
  'trivial',
  'simple',
  'moderate',
  'complex',
  'epic',
]);

export const TaskDangerSchema = z.enum([
  'safe',
  'low',
  'medium',
  'high',
  'critical',
]);

export const TaskTypeSchema = z.enum([
  'manual',
  'auto',
  'sync',
]);

export const CreateTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title too long'),
  description: z.string().max(5000, 'Description too long').optional(),
  status: TaskStatusSchema.default('intake'),
  priority: TaskPrioritySchema.default('medium'),
  complexity: TaskComplexitySchema.default('simple').optional(),
  danger: TaskDangerSchema.default('safe').optional(),
  type: TaskTypeSchema.default('manual'),
  assignedTo: z.string().max(50).nullable().optional(),
  list: z.string().max(50).default('agents'),
  tags: z.array(z.string().max(50)).default([]),
  dueDate: z.string().datetime().nullable().optional(),
  estimatedMinutes: z.number().int().positive().max(10080).nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  projectId: z.string().max(100).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const UpdateTaskSchema = z.object({
  id: z.string().uuid('Invalid task ID'),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  status: TaskStatusSchema.optional(),
  priority: TaskPrioritySchema.optional(),
  complexity: TaskComplexitySchema.optional(),
  danger: TaskDangerSchema.optional(),
  type: TaskTypeSchema.optional(),
  assignedTo: z.string().max(50).optional().nullable(),
  list: z.string().max(50).optional(),
  tags: z.array(z.string().max(50)).optional(),
  dueDate: z.string().datetime().optional().nullable(),
  estimatedMinutes: z.number().int().positive().max(10080).optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  projectId: z.string().max(100).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  completedAt: z.string().datetime().optional(),
  blockedBy: z.array(z.string().uuid()).optional(),
  blockerDescription: z.string().max(1000).optional(),
  actualMinutes: z.number().int().nonnegative().max(10080).optional(),
});

export const DispatchTaskSchema = z.object({
  taskId: z.string().uuid('Invalid task ID'),
  agentId: z.string().min(1, 'Agent ID required').max(50),
  notify: z.boolean().default(true),
});

export const DecomposeTaskSchema = z.object({
  taskId: z.string().uuid('Invalid task ID'),
  model: z.string().max(100).optional(),
});

export const TaskQuerySchema = z.object({
  status: z.string().optional(),
  assignedTo: z.string().max(50).optional(),
  type: TaskTypeSchema.optional(),
  priority: TaskPrioritySchema.optional(),
  list: z.string().max(50).optional(),
  tag: z.string().max(50).optional(),
  backburnered: z.enum(['true', 'false']).optional(),
  sort: z.string().max(50).optional(),
});

// Helper to validate and return parsed data or error response
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: true;
  data: T;
} | {
  success: false;
  error: { message: string; issues: z.ZodIssue[] };
} {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return {
    success: false,
    error: {
      message: 'Validation failed',
      issues: result.error.issues,
    },
  };
}
