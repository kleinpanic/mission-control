# Mission Control vs oc-tasks CLI — Gap Analysis

> Generated: 2026-02-15 by KleinClaw-Meta during system triage.
> Both MC and oc-tasks share `~/.openclaw/data/tasks.db` (same SQLite DB).

## Architecture

- **MC Web UI**: Port 3333, source at `~/codeWS/Projects/mission-control/`
- **oc-tasks CLI**: Installed tool, database at `~/.openclaw/data/tasks.db`
- **Shared DB**: Changes in CLI appear in MC and vice versa — single source of truth

## Gaps: MC Has, CLI Doesn't

| Feature | MC Route/UI | Notes |
|---------|-------------|-------|
| Visual Kanban board | Dashboard | Drag-and-drop task management |
| Real-time WebSocket updates | `/api/tasks/[id]/progress` | Live activity feed |
| Dispatch to agents | `/api/tasks/dispatch` | One-click agent assignment + autonomous mode start |
| Auto-decompose UI | `/api/tasks/auto-decompose` | Break complex tasks into subtasks visually |
| Cron management page | `/api/cron/` | ⚠️ Broken: `operator.read` scope error on WebSocket |
| Session viewer | `/api/sessions/` | Browse agent sessions |
| Cost tracking dashboard | `/api/costs/` | Spending by agent/model |
| Capability evolver UI | `/api/evolver/` | View/approve evolution proposals |
| Analytics page | Dashboard | Charts and trends |
| Approvals page | Dashboard | Review pending agent decisions |

## Gaps: CLI Has, MC Doesn't

| Feature | CLI Command | Priority |
|---------|-------------|----------|
| SLA checking | `oc-tasks sla-check` | Medium — policy enforcement |
| Backburner tracking | `oc-tasks backburner` | Low — auto-shelved tasks |
| Effort timers | `oc-tasks timer` | Medium — time tracking |
| External sync | `oc-tasks sync` | Low — Apple Reminders integration |
| Migration tools | `oc-tasks migrate` | One-time — import markdown todos |
| Full-text search | `oc-tasks search` | High — should be in MC search bar |
| Task deletion | `oc-tasks delete` | Medium — may not be in MC UI |

## oc-tasks CLI Commands Reference

```
list        Filter by status/priority/list/agent/tag/project/sort/format
add         Create with priority/complexity/danger/list/agent
show        Full details + activity log
done        Mark complete
move        Change status (intake→ready→in_progress→review→done)
block       Block a task (with reason)
unblock     Unblock
update      Edit fields
delete      Remove task
search      Full-text search
overdue     Past-due tasks
sla-check   SLA policy evaluation
backburner  Auto-backburnered tasks
triage      Intake tasks with auto-classification
next        Highest-priority ready task for agent
timer       Effort tracking (start/stop/status)
sync        External system sync
migrate     Import markdown todos + MC data
stats       Velocity, completion rates, agent breakdown
```

## MC API Endpoints

```
GET/POST    /api/tasks/              CRUD + list
GET         /api/tasks/[id]/progress Real-time progress (WebSocket)
POST        /api/tasks/[id]/signal   Task signals
POST        /api/tasks/[id]/triage   Triage actions
POST        /api/tasks/auto-decompose AI-powered decomposition
GET/POST    /api/tasks/classify      Auto-classification
POST        /api/tasks/decompose     Manual decomposition
POST        /api/tasks/dispatch      Dispatch to agents
GET         /api/tasks/next          Next task for agent
GET         /api/tasks/velocity      Velocity metrics
POST        /api/tasks/pause         Pause task
GET         /api/agents/             Agent info
GET         /api/cron/               Cron management (⚠️ broken)
GET         /api/taskmaster/         Taskmaster-specific
GET         /api/sessions/           Session viewer
GET         /api/costs/              Cost tracking
GET         /api/evolver/            Capability evolver
GET         /api/issues/             Issue tracker
```

## Known Issues

1. **MC Cron Page**: `operator.read` scope error — WebSocket client connects without proper auth token
2. **Task status display**: `task-pipeline.sh summary` exit code shows as "failed" in Slack even when output is valid (cosmetic)

## Recommendations

1. Add `oc-tasks search` to MC search bar (high priority)
2. Add SLA check widget to dashboard
3. Fix cron page WebSocket auth (needs operator.read scope)
4. Add task deletion to MC UI
5. Expose effort timer in task detail view
