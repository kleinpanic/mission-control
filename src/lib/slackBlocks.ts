// Slack Block Kit builders for Mission Control
import type { Task } from '@/types';

export interface TaskCardOptions {
  compact?: boolean;
  showButtons?: boolean;
}

export function taskCardBlocks(task: Task, options: TaskCardOptions = {}) {
  const { compact = false, showButtons = true } = options;
  const shortId = task.id.slice(0, 8);
  const priorityEmoji = task.priority === 'critical' ? "🔴" : ['high', 'medium'].includes(task.priority) ? "🟡" : "⚪";
  const agentText = task.assignedTo ? ` • Assigned to *${task.assignedTo}*` : " • Unassigned";
  
  if (compact) {
    // Compact version for /kanban view
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${priorityEmoji} *${task.title}* [\`${shortId}\`]${agentText}`,
        },
      },
    ];
  }
  
  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${priorityEmoji} ${task.title}`,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*ID:*\n\`${shortId}\``,
        },
        {
          type: "mrkdwn",
          text: `*Status:*\n${task.status.toUpperCase()}`,
        },
        {
          type: "mrkdwn",
          text: `*Priority:*\n${task.priority}`,
        },
        {
          type: "mrkdwn",
          text: `*Agent:*\n${task.assignedTo || "Unassigned"}`,
        },
      ],
    },
    ...(task.description
      ? [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Description:*\n${task.description}`,
            },
          },
        ]
      : []),
    ...(showButtons ? [{
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Move to Ready",
          },
          value: `${task.id}:ready`,
          action_id: "task_move",
          style: "primary",
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Start Work",
          },
          value: `${task.id}:in_progress`,
          action_id: "task_move",
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Mark Done",
          },
          value: `${task.id}:completed`,
          action_id: "task_move",
          style: "primary",
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Block",
          },
          value: `${task.id}:blocked`,
          action_id: "task_move",
          style: "danger",
        },
      ],
    }] : []),
  ];
}

export function errorBlock(message: string) {
  return {
    response_type: "ephemeral",
    text: `❌ ${message}`,
  };
}

export function helpBlock() {
  return {
    response_type: "ephemeral",
    text: `*Kanban Slash Commands*
    
\`/kanban view\` - Show active tasks
\`/kanban add <title>\` - Create new task
\`/kanban move <id> <status>\` - Move task to status
\`/kanban next\` - Show next ready task
\`/kanban assign <id> <agent>\` - Assign task to agent

*Statuses:* intake, ready, in-progress, review, completed, backlog, paused, blocked, archived

*Interactive Buttons:*
Click "Details" on any task to see full info and action buttons.`,
  };
}
