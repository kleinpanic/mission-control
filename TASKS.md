# Mission Control - Task List

## Completed ✅

### P1 - Dashboard (High Priority)
- [x] Fix timestamps showing "never" / heartbeat "null" — get real lastActivity from sessions
- [x] Add Next Heartbeat preview + skip/trigger button
- [x] Add Next Cron preview (show next scheduled job from cron.list)
- [x] Show real agent status (active/idle/waiting based on session activity)
- [x] Show actual agent count (not hardcoded 0/6)
- [x] Show WebSocket connection status (connected/disconnected/connecting)

### P2 - Cost Tracker
- [x] Add daily/weekly/monthly cost charts (recharts)
- [x] Add trends visualization with actual graphs (CostTrendChart, ModelUsageChart)
- [x] Fix aggregation for null totalCost values
- [x] Add caching (5 min TTL) for performance

### P3 - Other Features
- [x] Kanban: verified New Task works (database functional, empty state is expected)
- [x] Settings: added model selection per agent with dropdown
- [x] Cron: caching already implemented (30s TTL)
- [x] Sessions: added prune buttons for 95%+ capacity sessions
- [x] Sessions: show model details + max token info

### WebSocket & Integration
- [x] GatewayProvider with WebSocket handshake (Protocol v3)
- [x] Dashboard using live `status`, `usage.cost`, `cron.list`
- [x] Real-time event subscriptions (agent, heartbeat, cron, health)
- [x] Compact Session button via `sessions.compact`
- [x] Light/Dark/System theme toggle
- [x] Analytics page with log viewer + agent filtering
- [x] Fixed WebSocket env variable name
- [x] Fixed agent display (6 agents showing)
- [x] Autonomy Approvals page (/approvals)
- [x] Capability Evolver page (/evolver)

## Development Sprint Summary

**Bug Fix Sprint (Priorities 1-6):** ✅ Complete
- Priority 1: Dashboard critical fixes
- Priority 2: Cost Tracker aggregation & charts
- Priority 3: Sessions management (prune, model info)
- Priority 4: Cron caching (already done)
- Priority 5: Kanban verified working
- Priority 6: Settings enhanced (model selection)

**Feature Sprint:** ✅ Complete
- Better Analytics (cost trends, agent filtering, model breakdown)
- Proactive Autonomy Approvals (queue system, approve/reject UI)
- Capability Evolver Visual Control (genes, evolutions, history)

**Commits:** 10 total commits
- 3 main bug fix commits (0a4dc7a, 1f34d97, 7b78068)
- 3 feature commits (c61e495, 76a53d4, 0655d70)
- 4 WebSocket/integration fixes (by Klein)

**Build Status:** ✅ Passing
**Location:** http://10.0.0.27:3333

## Notes
- WebSocket spec: `WEBSOCKET-SPEC.md`
- Dev server: `PORT=3333 npm run dev`
- Build check: `npm run build`

**Round 4 (Security + Dynamic + Kanban Dispatch):** ✅ Complete (2026-02-14)
- Security: Remove NEXT_PUBLIC token, server-side auth proxy, MC password support
- Dynamic agents: Remove hardcoded 6-agent list, fully dynamic from gateway
- Heartbeat fix: Proper field mapping from heartbeat.next + heartbeat.agents
- Token usage: Accurate context % with model-specific fallbacks
- Kanban dispatch: /api/tasks/dispatch endpoint, dispatch UI on task cards
- Agent submenu in dropdown, dynamic agent list in TaskModal
- Auto-refresh (30s) + Sync button for external DB changes
- Tests updated and passing (21/21)

## Next Steps (Future)
- [x] Add compact/prune automation policies (CompactionPolicies component - auto-compact threshold, stale pruning, protected agents)
- [x] Add session compaction scheduling (integrated into CompactionPolicies with batch Run Now)
- [x] Add model usage alerts (ModelUsageAlerts component - flags disproportionate spend + paid fallback)
- [x] Add cost budget thresholds (BudgetAlerts component - configurable daily/weekly/monthly with localStorage)
- [x] Enhance realtime event filtering (ActivityFeed filter by event type + agent)

## Round 5 (Auto-Decompose + Velocity Tracking) - API Complete ✅
- [x] Auto-decompose API endpoint (/api/tasks/auto-decompose)
  - POST: Decompose task or scan eligible tasks
  - GET: List eligible tasks (moderate/epic, no subtasks)
- [x] Velocity tracking API endpoint (/api/tasks/velocity)
  - GET: Agent throughput metrics + 7-day trends
  - POST: Snapshot, recommend, assign actions
- [x] Enhanced dispatch API with auto-decompose trigger
  - Hook integration (task-dispatch-trigger.sh)
  - Fallback to direct gateway send
- [ ] UI Integration
  - [ ] Add "Auto-Decompose" button to Kanban (scan + decompose eligible tasks)
  - [ ] Add velocity dashboard page (/velocity) with agent metrics
  - [ ] Add "Smart Assign" button in Kanban (use velocity recommendation)
  - [ ] Show decomposition status in task details
  - [ ] Add auto-decompose toggle in TaskModal/dispatch UI
