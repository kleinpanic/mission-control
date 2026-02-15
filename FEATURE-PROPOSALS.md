# Mission Control - New Feature Proposals

**Date:** 2026-02-14  
**Author:** KleinClaw-Dev  
**Status:** Proposal / Awaiting Klein Approval

---

## Executive Summary

Three major features proposed to enhance Mission Control's autonomous agent orchestration:

1. **Issue Discovery Mode** - Automated issue detection across projects
2. **Task Decomposition System** - Break complex tasks into subtasks automatically
3. **Better Slack-Kanban Integration** - Tighter coupling between Slack and kanban

**Recommended Priority:** Slack-Kanban → Task Decomposition → Issue Discovery  
**Rationale:** Slack integration provides immediate UX wins with existing features, task decomposition unlocks agent autonomy, issue discovery builds on both foundations.

---

## 1. Issue Discovery Mode

### Overview
Automated issue detection across all agent-managed projects using static analysis tools, integrated with GitHub Issues and displayed in Mission Control dashboard.

### Architecture

#### Components

1. **Issue Scanner Service** (`src/services/issueScanner.ts`)
   - Runs periodic scans (cron-triggered or on-demand)
   - Integrates with multiple static analysis tools:
     - **TypeScript/JavaScript:** ESLint, TypeScript compiler diagnostics
     - **Python:** pylint, flake8, mypy
     - **Rust:** clippy, cargo check
     - **Go:** golangci-lint
   - Outputs unified issue format:
     ```typescript
     interface DiscoveredIssue {
       id: string;
       projectId: string;
       severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
       category: 'bug' | 'security' | 'code-smell' | 'performance' | 'style';
       file: string;
       line: number;
       column?: number;
       rule: string;
       message: string;
       suggestion?: string;
       discoveredAt: string;
       agentOwner: string;
     }
     ```

2. **GitHub Integration** (`src/services/githubIssueSync.ts`)
   - Option to auto-create GitHub issues from discovered problems
   - Tag with `auto-discovered`, severity label, category label
   - Link back to Mission Control for triage
   - Avoid duplicates via issue fingerprinting (file+line+rule hash)

3. **Dashboard UI** (`src/app/issues/page.tsx`)
   - **Filters:**
     - Severity (critical, high, medium, low)
     - Category (bug, security, code-smell, performance, style)
     - Project
     - Agent owner
     - Status (new, acknowledged, resolved, false-positive)
   - **Views:**
     - Table view with sorting
     - Grouped by project
     - Severity heatmap
   - **Actions:**
     - Mark as false positive
     - Create GitHub issue
     - Assign to agent
     - Bulk operations

4. **API Endpoints**
   ```typescript
   GET  /api/issues                  // List discovered issues with filters
   POST /api/issues/scan/:projectId  // Trigger scan for project
   POST /api/issues/:id/dismiss      // Mark as false positive
   POST /api/issues/:id/create-gh    // Create GitHub issue
   GET  /api/issues/stats            // Dashboard metrics
   ```

#### Implementation Phases

**Phase 1: Core Scanner (1 week)**
- Implement IssueScanner service with ESLint integration (TypeScript focus)
- Database schema for discovered issues
- Basic `/api/issues` endpoint
- Cron job to scan Mission Control itself as proof-of-concept

**Phase 2: UI & Filtering (4 days)**
- Issue dashboard page
- Filters, sorting, status management
- GitHub issue creation button

**Phase 3: Multi-Language Support (1 week)**
- Add Python, Rust, Go static analysis integrations
- Project language detection
- Configurable scan rules per project

**Phase 4: Automation (3 days)**
- Auto-scan on git push (GitHub webhook)
- Auto-create issues for critical/high severity
- Agent notification on new issues

#### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| False positives overwhelming agents | Severity thresholds, smart filtering, ML-based relevance scoring over time |
| Performance on large codebases | Incremental scans (diff-only), background workers, caching |
| Static analysis tool installation | Docker containers with tools pre-installed, fallback to GitHub Actions |

---

## 2. Task Decomposition System

### Overview
LLM-powered task decomposition that breaks complex tasks into hierarchical subtasks, integrated with oc-tasks CLI and Mission Control kanban.

### Architecture

#### Components

1. **Decomposition Engine** (`src/services/taskDecomposer.ts`)
   - Uses OpenClaw's LLM (via gateway API) to analyze task descriptions
   - Generates hierarchical subtask tree:
     ```typescript
     interface TaskDecomposition {
       originalTaskId: string;
       subtasks: SubtaskNode[];
       estimatedComplexity: 'simple' | 'medium' | 'complex';
       dependencies: TaskDependency[];
     }

     interface SubtaskNode {
       title: string;
       description: string;
       estimatedMinutes?: number;
       type: 'research' | 'implementation' | 'testing' | 'documentation';
       dependencies: string[]; // subtask titles this depends on
       children?: SubtaskNode[]; // nested subtasks
     }
     ```

   - Prompt template:
     ```
     Analyze this task and break it into actionable subtasks.
     
     Task: {title}
     Description: {description}
     
     Generate a hierarchical breakdown with:
     - Clear, actionable subtask titles
     - Dependencies between subtasks
     - Estimated effort (simple/medium/complex)
     - Type classification (research/implementation/testing/docs)
     
     Output JSON format: {...}
     ```

2. **oc-tasks CLI Integration**
   - New command: `oc-tasks decompose <taskId> [--depth <n>] [--auto-create]`
   - Uses existing `parentId` field for hierarchy
   - Creates subtasks in `intake` status by default
   - Preserves original task as parent (moves to `blocked` until subtasks complete)

3. **Mission Control UI** (`src/app/kanban/TaskDecomposer.tsx`)
   - **Trigger:** Button on task cards "Decompose Task"
   - **Preview Modal:**
     - Shows proposed subtask tree
     - Edit/remove subtasks before creation
     - Dependency graph visualization
   - **Tree View:**
     - Expandable subtask hierarchy
     - Drag-to-reorder
     - Inline editing
   - **Auto-Approval Option:** Skip preview for simple tasks (< 5 subtasks, no conflicts)

4. **API Endpoints**
   ```typescript
   POST /api/tasks/:id/decompose      // Generate decomposition
   POST /api/tasks/:id/subtasks       // Create subtasks from approved decomposition
   GET  /api/tasks/:id/tree           // Get full task hierarchy
   PUT  /api/tasks/:id/dependencies   // Update dependencies
   ```

#### Integration with Agent Triage

**Option A: Standalone (Recommended)**
- Available to all users, even without task management agents
- UI-driven workflow in Mission Control
- oc-tasks CLI for manual decomposition

**Option B: Agent-Integrated**
- Task management agent (if exists) auto-decomposes `intake` tasks above complexity threshold
- Presents decomposition in Slack for approval
- Auto-creates subtasks after approval

**Recommendation:** Start with Option A (standalone), add Option B later if Klein adds task management agent.

#### Implementation Phases

**Phase 1: Core Engine (1 week)**
- TaskDecomposer service with LLM integration
- Prompt engineering for quality decompositions
- oc-tasks decompose command
- Database schema for dependencies

**Phase 2: UI (1 week)**
- Decompose button on task cards
- Preview modal with tree view
- Subtask creation workflow
- Hierarchy visualization in kanban

**Phase 3: Smart Decomposition (4 days)**
- Context-aware prompts (include project type, agent skills)
- Dependency graph validation (cycle detection)
- Effort estimation calibration

**Phase 4: Automation (3 days)**
- Auto-decompose threshold (e.g., complexity=complex tasks)
- Batch decomposition for multiple tasks
- Template library (common task patterns)

#### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| LLM generates nonsense subtasks | Human approval required by default, quality scoring, user feedback loop |
| Over-decomposition (100+ subtasks) | Max depth limit (3 levels), max subtask count (20), complexity threshold |
| Dependency conflicts | Cycle detection, dependency validation, topological sort preview |

---

## 3. Better Slack-Kanban Integration

### Overview
Tighter coupling between Slack notifications and kanban board operations, reducing context-switching and improving agent workflow visibility.

### Architecture

#### Components

1. **Slack Bot Commands**
   - `/kanban view [project]` - Show mini kanban view in Slack (Block Kit cards)
   - `/kanban add <title>` - Quick task creation
   - `/kanban move <id> <status>` - Move task between columns
   - `/kanban next` - Get next ready task for current agent
   - `/kanban assign <id> @agent` - Assign task to agent

2. **Interactive Message Actions** (`src/services/slackActions.ts`)
   - **Task Card Buttons:**
     - "Move to In Progress" → updates task status, posts to Slack
     - "Move to Review" → same
     - "Complete" → marks done, celebrates in channel
     - "Block" → prompts for reason, moves to blocked
   - **Inline Status Changes:**
     - Dropdown menu on task cards: "Ready → In Progress → Review → Done"
   - **Agent Assignment:**
     - User picker on task cards
     - Notifies assigned agent

3. **Real-Time Sync** (`src/services/slackSync.ts`)
   - **Webhook Integration:**
     - On task status change in Mission Control → post update to Slack channel
     - On task created in Slack → create in oc-tasks + show in kanban
   - **WebSocket Relay:**
     - Reuse existing Mission Control WebSocket for Slack updates
     - Bidirectional sync: Slack ↔ Mission Control ↔ oc-tasks DB

4. **Agent Activity Feed** (`src/components/slack/ActivityFeed.tsx`)
   - **Slack Channel:** `#agent-activity` or per-agent channels
   - **Events:**
     - "Dev started work on task #42 (crypto-quantsight bug)"
     - "Main moved task #17 to review (email summarization)"
     - "Ops blocked task #8 (needs Klein's password)"
   - **Formatting:**
     - Rich Block Kit cards with task title, description snippet, buttons
     - Thread replies for task comments/updates
     - Emoji reactions for quick feedback (✅ approve, ❌ reject)

5. **Slash Command Handler** (`src/api/slack/commands/route.ts`)
   - Receives Slack slash command webhooks
   - Authenticates request (verify Slack signature)
   - Routes to appropriate handler (view, add, move, next, assign)
   - Returns ephemeral response (only visible to user) or channel message

6. **Block Kit Templates** (`src/lib/slackBlocks.ts`)
   ```typescript
   function taskCardBlock(task: Task): Block[] {
     return [
       {
         type: "section",
         text: {
           type: "mrkdwn",
           text: `*${task.title}* [#${task.id.slice(0, 8)}]\n${task.description || '_No description_'}`
         },
         accessory: {
           type: "button",
           text: { type: "plain_text", text: "View in MC" },
           url: `https://mission-control.local/kanban?task=${task.id}`
         }
       },
       {
         type: "context",
         elements: [
           { type: "mrkdwn", text: `*Status:* ${task.status}` },
           { type: "mrkdwn", text: `*Priority:* ${task.priority}` },
           { type: "mrkdwn", text: `*Owner:* ${task.assignedTo || 'Unassigned'}` }
         ]
       },
       {
         type: "actions",
         elements: [
           { type: "button", text: "Start", value: "move:in_progress", action_id: "task_start" },
           { type: "button", text: "Review", value: "move:review", action_id: "task_review" },
           { type: "button", text: "Done", value: "move:completed", action_id: "task_done", style: "primary" }
         ]
       }
     ];
   }
   ```

#### Implementation Phases

**Phase 1: Slash Commands (1 week)**
- `/kanban view` and `/kanban next` commands
- Basic task card rendering with Block Kit
- API endpoint for Slack webhook handling
- Authentication + signature verification

**Phase 2: Interactive Buttons (1 week)**
- Button handlers for status changes
- oc-tasks CLI integration (move, done)
- Ephemeral "success" messages
- Error handling (task not found, permission denied)

**Phase 3: Real-Time Sync (1 week)**
- WebSocket → Slack webhook on task updates
- Slack action → update Mission Control kanban (no refresh needed)
- Channel configuration (which channels get which updates)
- Rate limiting + batching to avoid Slack API limits

**Phase 4: Activity Feed (4 days)**
- Agent activity channel setup
- Formatted event messages (task started, completed, blocked)
- Thread replies for task discussions
- Reaction-based actions (👍 = approve, 🚫 = block)

#### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Slack rate limits (1 req/sec) | Batch updates, queue with retry, cache responses |
| Security (anyone with webhook URL can act) | Signature verification, user permission checks, audit log |
| Message spam overwhelming channels | Configurable filters (only show critical events), digest mode (batched updates every 15min) |
| Sync conflicts (Slack vs MC vs oc-tasks) | Last-write-wins with timestamp, conflict resolution UI |

---

## Prioritization Recommendation

### 1. Slack-Kanban Integration (First)
**Why:**
- **Immediate UX wins** - Reduces context-switching for Klein and agents
- **Builds on existing features** - Kanban and oc-tasks already work well
- **Low risk** - Well-documented Slack API, proven patterns
- **High visibility** - Klein uses Slack constantly, this will be felt immediately

**Estimated Effort:** 3-4 weeks
**Value:** High (daily workflow improvement)

### 2. Task Decomposition System (Second)
**Why:**
- **Unlocks agent autonomy** - Agents can break down complex work independently
- **Reduces Klein's load** - Less task grooming required
- **Builds on Slack integration** - Decomposition approvals via Slack buttons
- **Moderate risk** - LLM quality is key, but preview/approve mitigates

**Estimated Effort:** 3 weeks
**Value:** High (enables deeper autonomous work)

### 3. Issue Discovery Mode (Third)
**Why:**
- **Requires stable foundation** - Best with good task system + Slack integration
- **Higher complexity** - Multi-language static analysis, avoiding false positives
- **Less urgent** - Manual issue discovery works okay for now
- **Builds on decomposition** - Auto-discovered issues can be auto-decomposed

**Estimated Effort:** 3-4 weeks
**Value:** Medium-High (scales agent project ownership)

---

## Next Steps

**For Klein:**
1. **Approve/reject/modify** this proposal
2. **Prioritize:** Agree on order (or reorder)
3. **Decide scope:** Full feature or MVP first?
4. **Timeline:** When should dev start? (Can begin immediately if approved)

**For Dev:**
1. Create feature branches for approved features
2. Implement in phases (each phase = PR for review)
3. Document all new APIs and UX patterns
4. Write tests for each component

**Total Estimated Time (All Three):** 10-12 weeks (~3 months)  
**Per Feature:** 3-4 weeks each
