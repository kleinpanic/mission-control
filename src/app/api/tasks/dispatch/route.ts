// Mission Control - Task Dispatch API
// Dispatches tasks to agents with autonomous work trigger + auto-decompose
import { NextRequest, NextResponse } from 'next/server';
import { getTask, updateTask } from '@/lib/db';
import { logTaskActivity } from '@/lib/taskActivity';
import { DispatchTaskSchema, validateRequest } from '@/lib/validation';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789';
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || '';
const DISPATCH_HOOK = `${process.env.HOME}/.openclaw/hooks/task-dispatch-trigger.sh`;

function getHttpUrl(): string {
  return GATEWAY_URL.replace('ws://', 'http://').replace('wss://', 'https://');
}

async function gatewayRequest(method: string, params: Record<string, any>): Promise<any> {
  const httpUrl = getHttpUrl();
  const response = await fetch(`${httpUrl}/api/v1/invoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GATEWAY_TOKEN}`,
    },
    body: JSON.stringify({ method, params }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gateway ${method} failed: ${error}`);
  }

  return response.json();
}

/**
 * POST /api/tasks/dispatch
 * Dispatch a task to an agent for autonomous execution.
 * 
 * Body: { taskId: string, agentId: string, notify?: boolean, autoDecompose?: boolean }
 * 
 * Flow:
 * 1. Load the task from DB
 * 2. Move task to in_progress + assign agent
 * 3. Trigger dispatch hook (autonomous mode + optional auto-decompose)
 * 4. Send task details to the agent via gateway (fallback if hook fails)
 * 5. Notify Slack
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = validateRequest(DispatchTaskSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.message, issues: validation.error.issues },
        { status: 400 }
      );
    }

    const { taskId, agentId, notify: _notify } = validation.data;
    const autoDecompose = body.autoDecompose ?? false;

    // 1. Load the task
    const task = getTask(taskId);
    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Don't dispatch tasks that aren't in a dispatchable state
    const dispatchableStatuses = ['ready', 'intake', 'backlog'];
    if (!dispatchableStatuses.includes(task.status)) {
      return NextResponse.json(
        { error: `Task is in "${task.status}" status and cannot be dispatched. Only tasks in ${dispatchableStatuses.join('/')} status can be dispatched.` },
        { status: 400 }
      );
    }

    // 2. Update task: assign to agent, move to in_progress
    const updatedTask = updateTask(taskId, {
      status: 'in_progress',
      assignedTo: agentId,
    });

    if (!updatedTask) {
      return NextResponse.json(
        { error: 'Failed to update task' },
        { status: 500 }
      );
    }

    // Log dispatch activity
    logTaskActivity(taskId, 'dispatched', 'ui', task.status, `in_progress (${agentId})`);

    // 3. Try the dispatch trigger hook (starts autonomous mode + auto-decompose)
    let hookResult: { success: boolean; output?: string; error?: string } = { success: false };
    
    try {
      const decomposeFlag = (autoDecompose || task.complexity === 'moderate' || task.complexity === 'epic') 
        ? '--auto-decompose' : '';
      const { stdout, stderr } = await execAsync(
        `${DISPATCH_HOOK} "${taskId}" "${agentId}" ${decomposeFlag}`,
        { timeout: 60000 }
      );
      hookResult = { success: true, output: stdout };
      if (stderr) console.warn('[dispatch-hook] stderr:', stderr);
    } catch (hookErr) {
      console.warn('[dispatch-hook] Failed, falling back to direct send:', hookErr);
      hookResult = { 
        success: false, 
        error: hookErr instanceof Error ? hookErr.message : String(hookErr) 
      };
    }

    // 4. Fallback: Send task message directly if hook failed
    let sendResult: any = null;
    let sendError: string | null = null;

    if (!hookResult.success) {
      const priorityEmoji = {
        critical: '🔴',
        high: '🟠',
        medium: '🟡',
        low: '🟢',
      }[task.priority] || '⚪';

      const taskMessage = [
        `📋 **Task Dispatched: ${task.title}**`,
        ``,
        `**Priority:** ${priorityEmoji} ${task.priority}`,
        task.description ? `**Description:** ${task.description}` : null,
        task.complexity ? `**Complexity:** ${task.complexity}` : null,
        task.tags?.length ? `**Tags:** ${task.tags.join(', ')}` : null,
        task.dueDate ? `**Due:** ${task.dueDate}` : null,
        task.estimatedMinutes ? `**Estimated:** ${task.estimatedMinutes} minutes` : null,
        ``,
        `**Task ID:** ${task.id}`,
        `**Source:** Mission Control Kanban`,
        ``,
        `Please work on this task. When complete, update it via:`,
        `\`oc-tasks move ${task.id} review\``,
      ].filter(Boolean).join('\n');

      try {
        sendResult = await gatewayRequest('chat.send', {
          agentId,
          message: taskMessage,
        });
      } catch (e1) {
        try {
          const channelMap: Record<string, string> = {
            main: 'channel:C0ACZ4ZF8PR',
            dev: 'channel:C0AE8SG18KS',
            school: 'channel:C0ADCG0D6CW',
            meta: 'channel:C0AE270HDMY',
            ops: 'channel:C0ACZ4ZF8PR',
            research: 'channel:C0ACZ4ZF8PR',
            ghost: 'channel:C0AF33E020J',
          };

          const slackTarget = channelMap[agentId];
          if (slackTarget) {
            sendResult = await gatewayRequest('send', {
              to: slackTarget,
              message: taskMessage,
              channel: 'slack',
              idempotencyKey: `task-dispatch-${taskId}-${Date.now()}`,
            });
          }
        } catch (e2) {
          sendError = `Hook failed: ${hookResult.error}. Gateway fallback also failed: ${e2 instanceof Error ? e2.message : String(e2)}`;
        }
      }
    }

    // 5. Return result
    return NextResponse.json({
      success: true,
      task: updatedTask,
      dispatch: {
        agentId,
        hookTriggered: hookResult.success,
        hookOutput: hookResult.output?.slice(-500),
        sent: hookResult.success || !sendError,
        error: sendError,
        result: sendResult,
        autoDecomposed: (autoDecompose || task.complexity === 'moderate' || task.complexity === 'epic'),
      },
    });
  } catch (error) {
    console.error('Task dispatch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
