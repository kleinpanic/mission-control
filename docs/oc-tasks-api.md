# oc-tasks API & Data Model Reference

> For Mission Control WebUI developers. Documents the shared `oc-tasks` CLI, SQLite schema, and MC API endpoints that the WebUI must reflect.

**Database:** `~/.openclaw/data/tasks.db` (SQLite)  
**CLI:** `oc-tasks` (TypeScript, compiled)  
**MC API base:** `http://localhost:3333/api/tasks`

---

## Database Schema

### `tasks` table

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | TEXT PK | uuid | |
| `title` | TEXT | required | |
| `description` | TEXT | `''` | |
| `status` | TEXT | `'intake'` | See status lifecycle below |
| `priority` | TEXT | `'medium'` | `critical`, `high`, `medium`, `low` |
| `complexity` | TEXT | `'simple'` | `simple`, `moderate`, `complex`, `high` |
| `danger` | TEXT | `'safe'` | `safe`, `medium`, `high`, `critical` |
| `type` | TEXT | `'manual'` | `manual`, `ui`, `auto` |
| `assignedTo` | TEXT | null | Agent ID or null |
| `list` | TEXT | `'personal'` | `personal`, `agents`, `shared` |
| `tags` | TEXT (JSON) | `'[]'` | JSON array of strings |
| `detailScore` | INTEGER | 0 | How well-defined (0-100) |
| `minDetailRequired` | INTEGER | 0 | Minimum score to proceed |
| `autoBackburnered` | INTEGER | 0 | 1 if auto-shelved for low detail |
| `blockedBy` | TEXT (JSON) | `'[]'` | JSON array of task IDs |
| `blockerDescription` | TEXT | `''` | Human-readable block reason |
| `dueDate` | TEXT | null | ISO-8601 |
| `slaBreached` | INTEGER | 0 | Set by sla-check |
| `estimatedMinutes` | INTEGER | null | |
| `actualMinutes` | INTEGER | 0 | From timer sessions |
| `reminderId` | TEXT | null | Todoist reminder sync |
| `reminderList` | TEXT | null | |
| `reminderSyncedAt` | TEXT | null | |
| `parentId` | TEXT FK | null | Subtask → parent relationship |
| `projectId` | TEXT | null | |
| `createdAt` | TEXT | required | ISO-8601 |
| `updatedAt` | TEXT | required | ISO-8601 |
| `completedAt` | TEXT | null | Set when status → completed |
| `statusChangedAt` | TEXT | required | Updated on every status change |
| `source` | TEXT | `'cli'` | `cli`, `ui`, `agent`, `reminders`, `auto-decompose` |
| `metadata` | TEXT (JSON) | `'{}'` | Arbitrary JSON (classify results stored here) |
| `recommendedModel` | TEXT | null | From classifier |

### `task_activity` table (audit log)

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | uuid |
| `taskId` | TEXT FK | |
| `action` | TEXT | e.g. `status_change`, `assigned`, `created`, `updated` |
| `actor` | TEXT | Agent ID, `cli`, `ui`, `klein` |
| `oldValue` | TEXT | Previous value |
| `newValue` | TEXT | New value |
| `timestamp` | TEXT | ISO-8601 |

### `sla_policies` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | e.g. `blocked-stale` |
| `name` | TEXT | Human name |
| `description` | TEXT | |
| `conditions` | TEXT (JSON) | `{"status":"blocked","olderThanHours":24}` |
| `actions` | TEXT (JSON) | `{"type":"alert","tag":"stale","channel":"slack"}` |
| `enabled` | INTEGER | 0/1 |
| `createdAt` | TEXT | |

**Built-in SLA policies:**
- `blocked-stale` — blocked > 24h
- `ready-stale` — ready > 7 days
- `review-bottleneck` — > 5 tasks in review
- `overdue` — past due date
- `intake-untriaged` — intake > 48h

### `timer_sessions` table (effort tracking)

Tracks time spent on tasks by agents.

### `velocity_snapshots` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | |
| `agent` | TEXT | Agent ID |
| `date` | TEXT | YYYY-MM-DD |
| `completed_count` | INTEGER | Tasks done that day |
| `avg_cycle_hours` | REAL | Average hours to complete |
| `wip_count` | INTEGER | Work-in-progress count |
| `throughput_score` | REAL | Composite score |
| `metadata` | TEXT (JSON) | |
| `createdAt` | TEXT | |

### `agent_velocity` view (computed)

```sql
SELECT 
  assignedTo as agent,
  count(*) as total_completed,
  count(CASE WHEN completedAt > datetime('now', '-7 days') THEN 1 END) as completed_7d,
  count(CASE WHEN completedAt > datetime('now', '-30 days') THEN 1 END) as completed_30d,
  avg_hours_to_complete,  -- overall
  avg_hours_simple,       -- by complexity tier
  avg_hours_moderate,
  avg_hours_complex,
  current_wip,
  last_completed_at
FROM tasks WHERE assignedTo IS NOT NULL GROUP BY assignedTo
```

---

## Status Lifecycle

```
intake → ready → in_progress → review → completed
                    ↓                       ↑
                  blocked ──────────────────→
                    ↓
                  paused (manual, by Klein)
                    ↓
                  backlog (deprioritized)
                    ↓
                  archived (done/abandoned)
```

**Key rules:**
- `review` = work done, **waiting for Klein** to approve/reject. Agents must NOT re-work.
- `paused` = intentionally shelved by Klein. Agents must NOT pick up.
- `blocked` = has a `blockerDescription` explaining why.
- `intake` = new, untriaged. Awaits triage → ready.
- Only `ready` tasks are returned by `oc-tasks next`.

---

## List Separation (CRITICAL)

| List | Who owns it | Agent access |
|------|-------------|--------------|
| `personal` | Klein only | **Read-only.** Agents can scan/report/recommend but NEVER pick up, work on, or auto-assign personal tasks. |
| `agents` | Agents | Full CRUD. Agents pick these up via `next`, pipeline, dispatch. |
| `shared` | Both | Klein creates, agents can work when assigned. |

**Enforcement points (all filter `list != 'personal'`):**
- `oc-tasks next` (db.ts)
- `oc-tasks velocity assign`
- `task-pipeline.sh` auto-assign SQL
- `task-auto-decompose.sh` (single + scan)
- MC `/api/tasks/next` 
- MC `/api/tasks/dispatch` (returns 403 for personal)
- MC `/api/tasks/auto-decompose` (pre-shell DB check)

The WebUI Kanban shows `agents` + `shared` by default. Personal tasks appear in a **collapsible sidebar panel** (hidden by default) with a "Move to Agent Board" action.

---

## Task Classification (NEW — 2026-02-15)

**CLI:** `oc-tasks classify [id] [--text "..."] [--all] [--apply] [--format json]`  
**MC API:** `POST /api/tasks/classify` | `GET /api/tasks/classify?text=...`

Deterministic, zero-LLM classifier. Runs in <1ms. Analyzes task text across 14 signal dimensions:

| Dimension | What it detects |
|-----------|----------------|
| textLength | Short/long task descriptions |
| code | Programming keywords (build, deploy, refactor, etc.) |
| infra | Infrastructure (server, docker, network, etc.) |
| research | Research/investigation terms |
| academic | School/assignment keywords |
| simple | Quick/trivial indicators |
| danger | Dangerous operations (delete, production, etc.) |
| agentic | Multi-step agent work (autonomous, pipeline, etc.) |
| urgent | Time-sensitive language |
| system | System/config terms |
| creative | Design/UI terms |
| multiStep | Multi-step indicators |
| questions | Question patterns |
| constraints | Constraint/requirement patterns |

**Output:**
```json
{
  "score": 0.008,
  "tier": "SIMPLE",           // SIMPLE | MODERATE | COMPLEX | CRITICAL
  "confidence": 0.603,
  "signals": ["short (37 chars)", "code (build, react)"],
  "complexity": "simple",     // maps to task.complexity
  "priority": "low",          // maps to task.priority
  "danger": "safe",           // maps to task.danger
  "recommendedModel": "google-gemini-cli/gemini-3-flash-preview",
  "recommendedAgent": "dev",
  "isAgentic": false,
  "agenticScore": 0
}
```

**Auto-classify:** Fires automatically on `createTask()` when complexity, priority, and danger are all at defaults. Stores result in `metadata._classified`.

**WebUI integration needed:**
- Show classification badge on task cards (tier + confidence)
- "Classify" button on unclassified tasks
- Bulk "Classify All Intake" action
- Display `recommendedAgent` and `recommendedModel` in task detail view

---

## Task Compression (NEW — 2026-02-15)

**CLI:** `oc-tasks compress [file] [--stats-only] [--format json] [--threshold N] [--max-result N]`

5-layer compression pipeline (ported from ClawRouter):

1. **Deduplication** — removes repeated lines
2. **Whitespace** — normalizes spacing
3. **Path shortening** — abbreviates long paths (only if 2+ occurrences)
4. **JSON compaction** — minifies JSON blocks
5. **Observation compression** — truncates large tool outputs

**Use case:** Compress session transcripts before display or storage. Achieves ~95% reduction on typical agent sessions.

**WebUI integration:**
- Session viewer could offer "compressed view" toggle
- Show compression stats (original → compressed, % saved)

---

## Velocity Tracking (NEW — 2026-02-15)

**CLI:** `oc-tasks velocity [report|snapshot|recommend|assign]`

| Subcommand | Description |
|------------|-------------|
| `report [--agent X]` | Show velocity metrics (7d/30d completions, avg hours, WIP) |
| `snapshot` | Take daily velocity snapshot (run via cron/hook) |
| `recommend <taskId>` | Suggest best agent based on velocity + skills matching |
| `assign <taskId>` | Auto-assign to best agent |

**WebUI integration needed:**
- Agent velocity dashboard (chart: completions over time, avg cycle hours)
- "Recommend Agent" button on task detail → shows ranked agent suggestions
- "Auto-assign" button that calls velocity assign
- Velocity badges on agent cards (throughput score, current WIP)

---

## MC API Endpoints

### Core CRUD
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tasks` | List tasks (supports `?list=`, `?status=`, `?assignedTo=` filters) |
| POST | `/api/tasks` | Create task |
| GET | `/api/tasks/[id]` | Get task details |
| PATCH | `/api/tasks/[id]` | Update task |
| DELETE | `/api/tasks/[id]` | Delete task |

### Pipeline & Automation
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/tasks/dispatch` | Dispatch task to agent (starts autonomous mode). Returns 403 for personal tasks. |
| POST | `/api/tasks/pause` | Pause task + stop autonomous session |
| GET | `/api/tasks/next` | Get highest-priority ready task for agent. Excludes personal list. |
| POST | `/api/tasks/parse` | Parse natural language into task fields |
| POST | `/api/tasks/decompose` | Manual decompose (create subtasks) |
| POST | `/api/tasks/auto-decompose` | AI-powered decomposition via Gemini. Guards against personal tasks. |
| GET | `/api/tasks/auto-decompose` | List eligible tasks for decomposition |

### Classification & Analysis
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/tasks/classify` | Classify a task by ID |
| GET | `/api/tasks/classify?text=...` | Classify freeform text |
| GET | `/api/tasks/velocity` | Agent velocity report |

### Task Actions
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/tasks/[id]/triage` | Move from intake → ready with assignment |
| POST | `/api/tasks/[id]/signal` | Signal an event on a task |
| GET | `/api/tasks/[id]/progress` | Get task progress/activity log |

---

## Hook Scripts (Backend Automation)

These scripts power the task pipeline. MC calls some via shell exec:

| Hook | Path | What it does |
|------|------|-------------|
| `task-pipeline.sh` | `~/.openclaw/hooks/` | Orchestrates intake → triage → assign → dispatch |
| `task-plan.sh` | `~/.openclaw/hooks/` | Generates PLAN.md (trivial=skip, moderate=light, complex=full) |
| `task-verify.sh` | `~/.openclaw/hooks/` | Verification gate before review |
| `task-auto-decompose.sh` | `~/.openclaw/hooks/` | AI decomposition via Gemini CLI |
| `task-dispatch-trigger.sh` | `~/.openclaw/hooks/` | Starts autonomous mode on dispatch |
| `task-velocity.sh` | `~/.openclaw/hooks/` | Takes velocity snapshot |

---

## WebUI Upgrade Checklist

Features the WebUI needs to support based on recent oc-tasks changes:

### Must Have
- [ ] **Classification badges** on task cards (SIMPLE/MODERATE/COMPLEX/CRITICAL + confidence)
- [ ] **Classify button** — single task + bulk "Classify All Intake"
- [ ] **Recommended agent/model** display in task detail
- [ ] **Velocity dashboard** — per-agent metrics, throughput chart
- [ ] **Auto-assign button** using velocity scoring
- [ ] **SLA breach indicators** on overdue/stale tasks
- [ ] **Activity log** in task detail (task_activity table)
- [ ] **Subtask tree view** (parentId relationship)

### Nice to Have
- [ ] **Compressed session view** toggle
- [ ] **Velocity trend chart** (from velocity_snapshots)
- [ ] **Agent recommendation** on triage (shows top 3 agents + scores)
- [ ] **Detail score** gauge (how well-defined is this task?)
- [ ] **Auto-backburner indicator** for poorly-defined tasks
- [ ] **Timer/effort tracking** display per task

### API Changes to Wire Up
- `GET /api/tasks/classify?text=...` → for inline classification preview
- `POST /api/tasks/classify` → for applying to existing tasks
- `GET /api/tasks/velocity` → for velocity dashboard
- `velocity_snapshots` table → for trend charts
- `task_activity` table → for per-task activity feed
- `metadata._classified` field → for classification badges

---

## Data Enums Reference

For dropdowns, filters, and validation:

```typescript
const STATUSES = ['intake', 'ready', 'in_progress', 'blocked', 'review', 'completed', 'paused', 'backlog', 'archived'] as const;
const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
const COMPLEXITIES = ['simple', 'moderate', 'complex', 'high'] as const;
const DANGERS = ['safe', 'medium', 'high', 'critical'] as const;
const LISTS = ['personal', 'agents', 'shared'] as const;
const TYPES = ['manual', 'ui', 'auto'] as const;
const SOURCES = ['cli', 'ui', 'agent', 'reminders', 'auto-decompose'] as const;
const TIERS = ['SIMPLE', 'MODERATE', 'COMPLEX', 'CRITICAL'] as const;
```
