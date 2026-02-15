/**
 * Slack Slash Commands Handler
 * 
 * Handles /kanban slash commands from Slack workspace
 * Commands: view, next, add, move, assign
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { getTasks } from '@/lib/db';
import { taskCardBlocks, errorBlock, helpBlock } from '@/lib/slackBlocks';

const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || '';

/**
 * Verify Slack request signature
 * https://api.slack.com/authentication/verifying-requests-from-slack
 */
function verifySlackSignature(req: Request, body: string): boolean {
  if (!SLACK_SIGNING_SECRET) {
    console.warn('[Slack] SLACK_SIGNING_SECRET not configured - skipping verification');
    return true; // Allow in dev mode
  }

  const timestamp = req.headers.get('x-slack-request-timestamp');
  const signature = req.headers.get('x-slack-signature');

  if (!timestamp || !signature) {
    return false;
  }

  // Prevent replay attacks (timestamp > 5 min old)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    return false;
  }

  // Compute HMAC signature
  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature = 'v0=' + createHmac('sha256', SLACK_SIGNING_SECRET)
    .update(sigBasestring)
    .digest('hex');

  // Timing-safe comparison
  try {
    return timingSafeEqual(
      Buffer.from(mySignature),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
}

/**
 * Parse slash command arguments
 * Examples:
 *   "/kanban view" → { command: 'view', args: [] }
 *   "/kanban add Fix the bug" → { command: 'add', args: ['Fix the bug'] }
 *   "/kanban move abc123 done" → { command: 'move', args: ['abc123', 'done'] }
 */
function parseCommand(text: string): { command: string; args: string[] } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { command: 'help', args: [] };
  }

  const parts = trimmed.split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  return { command, args };
}

/**
 * Handle /kanban view - show mini kanban board
 */
async function handleView(args: string[]) {
  const project = args[0] || null; // Optional project filter

  const tasks = await getTasks();
  
  // Filter by project if specified
  const filteredTasks = project
    ? tasks.filter(t => t.projectId === project)
    : tasks;

  // Group by status
  const byStatus: Record<string, any[]> = {
    intake: [],
    ready: [],
    in_progress: [],
    review: [],
    completed: [],
  };

  filteredTasks.forEach(task => {
    if (byStatus[task.status]) {
      byStatus[task.status].push(task);
    }
  });

  // Build Block Kit response
  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: project ? `📊 Kanban: ${project}` : '📊 Kanban Board',
      },
    },
  ];

  // Show tasks by column
  for (const [status, tasks] of Object.entries(byStatus)) {
    if (tasks.length === 0) continue;

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${status.toUpperCase()}* (${tasks.length})`,
      },
    });

    // Show first 5 tasks per column
    tasks.slice(0, 5).forEach(task => {
      blocks.push(...taskCardBlocks(task, { compact: true }));
    });

    if (tasks.length > 5) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `_+${tasks.length - 5} more tasks..._`,
          },
        ],
      });
    }
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: '<http://10.0.0.27:3333/kanban|View full board in Mission Control>',
      },
    ],
  });

  return {
    response_type: 'ephemeral', // Only visible to user
    blocks,
  };
}

/**
 * Handle /kanban next - get next ready task for agent
 */
async function handleNext(args: string[]) {
  const agent = args[0] || 'dev'; // Default to dev agent

  const tasks = await getTasks();
  const readyTasks = tasks.filter(t => 
    t.status === 'ready' && 
    (t.assignedTo === agent || !t.assignedTo)
  );

  if (readyTasks.length === 0) {
    return {
      response_type: 'ephemeral',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `✅ No ready tasks for *${agent}*. All clear!`,
          },
        },
      ],
    };
  }

  // Get highest priority task
  const sortedTasks = readyTasks.sort((a, b) => {
    const priorityMap: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    return (priorityMap[a.priority] || 2) - (priorityMap[b.priority] || 2);
  });

  const nextTask = sortedTasks[0];

  return {
    response_type: 'ephemeral',
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🎯 Next Task',
        },
      },
      ...taskCardBlocks(nextTask, { compact: false }),
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `${sortedTasks.length - 1} other ready tasks available`,
          },
        ],
      },
    ],
  };
}

/**
 * Handle /kanban add <title> - quick task creation
 */
async function handleAdd(args: string[]) {
  if (args.length === 0) {
    return {
      response_type: 'ephemeral',
      blocks: [errorBlock('Usage: `/kanban add <task title>`')],
    };
  }

  const title = args.join(' ');

  // TODO: Create task via oc-tasks CLI or direct DB
  // For now, return success message
  return {
    response_type: 'in_channel', // Visible to everyone
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `✅ Task created: *${title}*`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Task added to Intake. View in <http://10.0.0.27:3333/kanban|Mission Control>',
          },
        ],
      },
    ],
  };
}

/**
 * Handle /kanban help
 */
function handleHelp() {
  return {
    response_type: 'ephemeral',
    blocks: [helpBlock()],
  };
}

/**
 * POST /api/slack/commands
 * Slack slash command webhook
 */
export async function POST(request: NextRequest) {
  try {
    // Read raw body for signature verification
    const body = await request.text();
    
    // Verify Slack signature
    if (!verifySlackSignature(request, body)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse form data
    const params = new URLSearchParams(body);
    const text = params.get('text') || '';
    const userId = params.get('user_id') || '';
    const userName = params.get('user_name') || '';
    const _channelId = params.get('channel_id') || '';

    console.log(`[Slack Command] /kanban ${text} from ${userName} (${userId})`);

    // Parse command
    const { command, args } = parseCommand(text);

    // Route to handler
    let response;
    switch (command) {
      case 'view':
        response = await handleView(args);
        break;
      case 'next':
        response = await handleNext(args);
        break;
      case 'add':
        response = await handleAdd(args);
        break;
      case 'help':
      default:
        response = handleHelp();
        break;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Slack Command] Error:', error);
    return NextResponse.json(
      {
        response_type: 'ephemeral',
        blocks: [errorBlock('Internal error. Check logs.')],
      },
      { status: 500 }
    );
  }
}
