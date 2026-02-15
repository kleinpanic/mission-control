# Mission Control - Autonomous Task Management Architecture

**Date:** 2026-02-14 21:17 EST  
**Status:** Design Document - Awaiting Klein Approval

---

## Goal

**Build a continuous autonomous task management backend** where:
- Agents autonomously pick up and work on tasks from a shared Kanban
- Klein can monitor and interact via WebUI
- Real-time updates across Slack, WebUI, and oc-tasks CLI
- Tasks flow smoothly through the system without manual intervention

---

## Current State

### What Works ✅
- **oc-tasks CLI** - SQLite database for tasks (`~/.openclaw/data/tasks.db`)
- **Mission Control WebUI** - Next.js app on port 3333, Kanban board UI
- **Slack Commands** - `/kanban` slash commands for task creation/viewing
- **Task Decomposition** - LLM-powered subtask generation
- **Agent Dispatch API** - `/api/tasks/dispatch` exists but not integrated

### What's Missing ❌
- **Autonomous Task Pickup** - Agents don't check Kanban during heartbeats
- **Real-Time Status Updates** - Agent work doesn't update Kanban automatically
- **Activity Dashboard** - Can't see what agents are currently working on
- **Task Routing** - No automatic assignment to capable agents
- **Workflow Automation** - Manual status changes only

---

## Proposed Architecture

### 1. Heartbeat Integration (Core Loop)

Every agent heartbeat (30min default) should:

```typescript
// Added to HEARTBEAT.md for each agent
async function autonomousTaskCheck() {
  // 1. Query oc-tasks for tasks ready for this agent
  const tasks = await db.query(`
    SELECT * FROM tasks 
    WHERE status = 'ready' 
    AND (assignedTo = ? OR assignedTo IS NULL)
    ORDER BY priority DESC, createdAt ASC
    LIMIT 1
  `, [agentId]);

  if (tasks.length === 0) {
    return 'HEARTBEAT_OK'; // No work available
  }

  const task = tasks[0];

  // 2. Check if agent has capability for this task
  if (!canHandleTask(task)) {
    return 'HEARTBEAT_OK'; // Skip tasks outside capability
  }

  // 3. Ask Klein for permission (semi-autonomous mode)
  const approved = await requestApproval(task);
  if (!approved) {
    return 'HEARTBEAT_OK'; // Klein declined
  }

  // 4. Update task status to in_progress
  await updateTaskStatus(task.id, 'in_progress');

  // 5. Start autonomous work session
  await sessions_spawn({
    label: `task-${task.id}:${task.title}`,
    task: task.description,
    agentId: getCurrentAgent(),
    cleanup: 'delete', // Auto-cleanup when done
    model: getAgentModel()
  });

  // 6. Post update to Slack + WebUI
  await notifyTaskStarted(task);

  return `Started work on task #${task.id}: ${task.title}`;
}
```

**Integration Points:**
- Modify each agent's `HEARTBEAT.md` to include this check
- Use `oc-tasks next --agent <id>` to get next task
- Spawn isolated session for task work (main spawns subagent, dev spawns dev-worker, etc.)
- Session updates Kanban status throughout work

### 2. Real-Time Activity Dashboard

**Component:** `src/components/dashboard/AgentActivity.tsx` (already exists, needs data)

**Data Source:** WebSocket + Server-Sent Events

```typescript
interface AgentActivityEvent {
  agentId: string;
  agentName: string;
  status: 'idle' | 'working' | 'waiting' | 'blocked';
  currentTask?: {
    id: string;
    title: string;
    startedAt: string;
    progress?: number; // 0-100
  };
  lastUpdate: string;
}

// WebSocket message types
type ActivityMessage =
  | { type: 'task_started'; agent: string; task: Task }
  | { type: 'task_progress'; agent: string; task: Task; progress: number }
  | { type: 'task_completed'; agent: string; task: Task }
  | { type: 'task_blocked'; agent: string; task: Task; reason: string }
  | { type: 'heartbeat'; agent: string; status: 'idle' | 'working' };
```

**API Endpoints:**
```typescript
GET  /api/agents/activity          // Get all agent statuses
GET  /api/agents/:id/activity      // Get specific agent status
POST /api/agents/:id/activity      // Update agent status (from agent itself)
```

**UI Features:**
- Live status badges (🟢 Working, 🟡 Waiting, 🔴 Blocked, ⚪ Idle)
- Current task title + elapsed time
- Progress bar (if agent reports progress)
- Quick actions: "Pause", "Reassign", "Cancel"

### 3. Task Routing & Assignment

**Auto-Assignment Logic:**

```typescript
interface AgentCapability {
  agentId: string;
  skills: string[]; // ['typescript', 'rust', 'system-admin', 'research']
  availability: 'available' | 'busy' | 'offline';
  currentLoad: number; // 0-100
}

async function assignTaskToAgent(task: Task): Promise<string | null> {
  // 1. Parse task for required skills (via tags or description)
  const requiredSkills = extractSkillsFromTask(task);

  // 2. Get available agents with matching skills
  const agents = await getAgentsWithSkills(requiredSkills);

  // 3. Filter by availability and load
  const availableAgents = agents.filter(a => 
    a.availability === 'available' && a.currentLoad < 80
  );

  if (availableAgents.length === 0) {
    return null; // No agent available
  }

  // 4. Rank by skill match + load balance
  const bestAgent = availableAgents.sort((a, b) => {
    const aScore = skillMatchScore(a, requiredSkills) - (a.currentLoad / 100);
    const bScore = skillMatchScore(b, requiredSkills) - (b.currentLoad / 100);
    return bScore - aScore;
  })[0];

  // 5. Assign task
  await updateTask(task.id, { assignedTo: bestAgent.agentId });

  return bestAgent.agentId;
}
```

**Manual Override:**
- Klein can always reassign via WebUI or `/kanban assign <id> <agent>`
- Auto-assignment is a suggestion, not a lock

### 4. Status Sync (Real-Time Updates)

**Bidirectional Sync:**

```
Agent Work Session
   ↓ (HTTP POST)
/api/tasks/:id/status
   ↓ (Update SQLite)
oc-tasks database
   ↓ (Trigger webhook)
WebSocket broadcast
   ↓ ↓ ↓
WebUI updates | Slack notification | oc-tasks CLI refresh
```

**Implementation:**
```typescript
// In agent's autonomous work session
async function updateProgress(taskId: string, status: TaskStatus, progress?: number) {
  await fetch(`http://localhost:3333/api/tasks/${taskId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, progress })
  });
}

// Agent calls this during work
await updateProgress(taskId, 'in_progress', 25); // 25% done
await updateProgress(taskId, 'in_progress', 50); // 50% done
await updateProgress(taskId, 'review'); // Ready for review
```

**WebSocket Handler:**
```typescript
// server.ts
wss.on('connection', (ws) => {
  // Subscribe to task updates
  taskDB.on('update', (task) => {
    ws.send(JSON.stringify({ type: 'task_updated', task }));
  });
});
```

### 5. Workflow Automation

**State Machine:**

```
         ┌─────────┐
         │ Intake  │ ← New tasks enter here
         └────┬────┘
              │
              ↓ (Triage: assign + tag)
         ┌─────────┐
         │  Ready  │ ← Available for pickup
         └────┬────┘
              │
              ↓ (Agent picks up / Klein approves)
      ┌───────────────┐
      │  In Progress  │ ← Agent working
      └───────┬───────┘
              │
      ┌───────┼───────┐
      │       │       │
      ↓       ↓       ↓
 ┌─────┐ ┌────────┐ ┌────────┐
 │Block│ │ Review │ │  Done  │
 └─────┘ └────┬───┘ └────────┘
              │
              ↓ (Klein approves)
         ┌─────────┐
         │  Done   │
         └─────────┘
```

**Automation Rules:**
1. **intake → ready:** Auto-transition when title+description filled and priority set
2. **ready → in_progress:** When agent accepts task
3. **in_progress → review:** When agent finishes work
4. **review → done:** When Klein approves (or auto after 24h if tagged `auto-approve`)
5. **Any → blocked:** Manual only (requires blocker reason)
6. **blocked → ready:** When blocker resolved

**API Endpoints:**
```typescript
POST /api/tasks/:id/transition     // Transition to next state
POST /api/tasks/:id/block           // Block with reason
POST /api/tasks/:id/unblock         // Unblock
GET  /api/tasks/:id/history         // Get status change history
```

---

## Implementation Plan

### Phase 1: Heartbeat Integration (3 days)
- Modify agent HEARTBEAT.md files to include task check
- Implement `oc-tasks next --agent <id>` filtering
- Test with dev agent picking up a manual task
- Verify status updates work end-to-end

### Phase 2: Activity Dashboard (4 days)
- Build AgentActivity component (wire up WebSocket)
- API endpoints for agent status
- Live status updates in WebUI
- Test with multiple agents working concurrently

### Phase 3: Auto-Assignment (3 days)
- Agent capability database (skills, availability)
- Assignment algorithm implementation
- UI for manual override
- Test with varied task types

### Phase 4: Real-Time Sync (3 days)
- WebSocket broadcast for task updates
- Slack notification hooks
- oc-tasks CLI webhook integration (if possible)
- Test multi-client sync (WebUI + Slack + CLI)

### Phase 5: Workflow Automation (2 days)
- State machine implementation
- Transition validation
- Auto-transition rules
- Audit log for status changes

**Total: ~15 days (3 weeks) for full autonomous loop**

---

## Success Criteria

### MVP (Minimum Viable Product)
- ✅ Dev agent picks up 1 task from Kanban during heartbeat
- ✅ Works on it autonomously (spawns session)
- ✅ Updates status in WebUI in real-time
- ✅ Klein can monitor progress via Activity Dashboard
- ✅ Task completes and moves to review

### Full System
- ✅ All 8 agents check Kanban on heartbeat
- ✅ Auto-assignment to capable agents
- ✅ Real-time status across WebUI + Slack + CLI
- ✅ Klein can interact via any interface
- ✅ Task history and audit log
- ✅ Workflow automation (intake → ready → progress → review → done)

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Agents pick up wrong tasks | Capability matching, Klein approval gate for first version |
| Token exhaustion from too many tasks | Max 1 task per heartbeat, pause when low on tokens |
| Task conflicts (2 agents pick same task) | Atomic DB update with lock, first-wins |
| WebUI performance with many updates | Debounce updates, batch WebSocket messages |
| Klein loses control | Manual override always available, pause button for autonomy |

---

## Next Steps

**Awaiting Klein's approval:**
1. Confirm this architecture matches your vision
2. Prioritize phases (or go full build in one push)
3. Choose starting agent (dev? main? all?)
4. Define initial capability tags for agents

**Once approved:**
- Create `feature/autonomous-task-loop` branch
- Implement Phase 1 (Heartbeat Integration) first
- Daily demos via browser screenshots to Slack
- Iterate based on Klein's feedback

---

**Questions for Klein:**
1. Should agents ask permission before picking tasks, or fully autonomous?
2. What skills/capabilities does each agent have? (for auto-assignment)
3. Slack notifications: every status change, or just critical events?
4. Auto-approve threshold for review → done? (e.g., tasks tagged `trivial`)
