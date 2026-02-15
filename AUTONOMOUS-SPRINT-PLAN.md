# Mission Control - Complete Autonomous Sprint Plan
**Started:** 2026-02-14 22:20  
**Agent:** dev  
**Directive:** Fix ALL remaining issues (medium, minor, improvements) + verify full system integration

---

## Sprint Structure

### Phase 1: Critical Blockers (DONE)
- [x] Fix WebSocket connection (proxy configuration)

### Phase 2: Dashboard Data Fixes (PRIORITY)
- [ ] Fix cost stats (shows $0, should show real usage)
- [ ] Fix channel status (shows 0, should show active channels)
- [ ] Add agent name mapping (show human names not IDs)
- [ ] Add session label mapping (show labels not cryptic keys)
- [ ] Fix taskmaster activity widget (last run, intake queue, SLA, model tiers)

### Phase 3: Kanban UX Fixes
- [ ] Add intake approval buttons (approve/reject directly from UI)
- [ ] Prevent decomposing completed tasks (validation rule)
- [ ] Show model recommendation badges (flash/sonnet/opus on task cards)
- [ ] Add natural language quick-add (like Apple Reminders)

### Phase 4: Activity Logging Integration
- [ ] Verify task_activity table exists and is logging
- [ ] Test UI actions log to task_activity
- [ ] Test CLI actions log to task_activity
- [ ] Test taskmaster triage logs to task_activity

### Phase 5: Full System Integration Testing
- [ ] Create task via Slack → appears in web UI
- [ ] Create task via CLI → appears in web UI
- [ ] Create task via web UI → appears in CLI
- [ ] Verify sync with Apple Reminders on macOS node (collins)
- [ ] Test taskmaster triage flow end-to-end
- [ ] Test agent dispatch from Mission Control

### Phase 6: Agent Integration
- [ ] Add Mission Control check to remaining agent heartbeats
- [ ] Configure autonomy levels per agent
- [ ] Set up Slack delivery routing for Mission Control work

### Phase 7: Safety Controls
- [ ] Add emergency stop button (pause all dispatch)
- [ ] Add stuck detection (>45min no progress → auto-pause)
- [ ] Add rate limiting (concurrent tasks per agent)
- [ ] Send notification when task is paused

### Phase 8: Polish & Minor Issues
- [ ] Add task search in web UI
- [ ] Add rate limit events to Analytics
- [ ] Add clear button for error history
- [ ] Show model aliases (gpt/opus/sonnet) with full names
- [ ] Make channels clickable (detail pages)
- [ ] Add heartbeat schedule details
- [ ] Add WIP limits configuration
- [ ] Add column bulk actions (mark all done, archive all, etc.)

---

## Execution Log

### 22:20 - Starting Phase 2 (Dashboard Data Fixes)
Working on cost stats fix...
