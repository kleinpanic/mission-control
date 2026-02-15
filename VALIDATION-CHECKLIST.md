# Mission Control Manual Validation Checklist

**URL:** http://10.0.0.27:3333  
**Date:** 2026-02-15  
**Validator:** _____________

## Global Checks (Apply to ALL pages)
- [ ] No console errors/warnings (check browser DevTools Console)
- [ ] No bottom-left error alerts
- [ ] WebSocket connected (not just localhost) - check status indicator
- [ ] Dark mode toggle works

---

## Page 1: Dashboard (/)

**URL:** http://10.0.0.27:3333/

### Checks
- [ ] Overview cards show data (agent count, session count, etc.)
- [ ] Agent count matches (should show 6 agents)
- [ ] Activity feed populates (shows recent agent activity)
- [ ] No console errors

### Screenshot
- [ ] Captured and saved as `screenshots/01-dashboard.png`

---

## Page 2: Agents (/agents)

**URL:** http://10.0.0.27:3333/agents

### Checks
- [ ] All 6 agents visible (main, dev, ops, school, sentinel, research)
- [ ] Status matches dashboard
- [ ] Heartbeat countdown works (timer decrements)
- [ ] No console errors

### Screenshot
- [ ] Captured and saved as `screenshots/02-agents.png`

---

## Page 3: Kanban (/kanban)

**URL:** http://10.0.0.27:3333/kanban

### Checks
- [ ] Columns render (Ready, In Progress, Review, Done)
- [ ] Can create task (click "+ New Task" button, fill form, submit)
- [ ] Drag and drop works (try moving a task between columns)
- [ ] No console errors

### Screenshot
- [ ] Captured and saved as `screenshots/03-kanban.png`

---

## Page 4: Approvals (/approvals)

**URL:** http://10.0.0.27:3333/approvals

### Checks
- [ ] Approval queue loads (shows pending approvals if any)
- [ ] Can approve/reject (buttons visible and functional)
- [ ] No console errors

### Screenshot
- [ ] Captured and saved as `screenshots/04-approvals.png`

---

## Page 5: Evolver (/evolver)

**URL:** http://10.0.0.27:3333/evolver

### Checks
- [ ] Capability list loads (shows agent capabilities)
- [ ] Review mode visible (can see review queue)
- [ ] No console errors

### Screenshot
- [ ] Captured and saved as `screenshots/05-evolver.png`

---

## Page 6: Costs (/costs)

**URL:** http://10.0.0.27:3333/costs

### Checks
- [ ] Shows real data (not $0.00 - should show actual usage)
- [ ] Charts render (bar/line charts for cost over time)
- [ ] Provider breakdown works (shows cost per provider: Anthropic, OpenAI, etc.)
- [ ] No console errors

### Screenshot
- [ ] Captured and saved as `screenshots/06-costs.png`

---

## Page 7: Cron (/cron)

**URL:** http://10.0.0.27:3333/cron

### Checks
- [ ] All cron jobs listed (shows scheduled jobs)
- [ ] "Run now" button works (try triggering a safe cron job)
- [ ] History loads (shows past executions)
- [ ] No console errors

### Screenshot
- [ ] Captured and saved as `screenshots/07-cron.png`

---

## Page 8: Sessions (/sessions)

**URL:** http://10.0.0.27:3333/sessions

### Checks
- [ ] Sessions list loads (shows active/recent sessions)
- [ ] No "invalid params" error
- [ ] Can view history (click on a session, see message history)
- [ ] No console errors

### Screenshot
- [ ] Captured and saved as `screenshots/08-sessions.png`

---

## Page 9: Settings (/settings)

**URL:** http://10.0.0.27:3333/settings

### Checks
- [ ] Agent configs shown (lists all 6 agents with their settings)
- [ ] Model selection works (can change model for an agent)
- [ ] No console errors

### Screenshot
- [ ] Captured and saved as `screenshots/09-settings.png`

---

## Navigation Test
- [ ] Can navigate between all pages using the sidebar
- [ ] WebSocket stays connected during navigation (status indicator remains green)
- [ ] No memory leaks after visiting all pages (check DevTools Memory tab)

---

## Dark Mode Test
- [ ] Toggle dark mode on Dashboard - works correctly
- [ ] Navigate to Agents page - dark mode persists
- [ ] Navigate to Costs page - dark mode persists
- [ ] Toggle back to light mode - works correctly

---

## Issues Found

| Page | Issue | Severity | Notes |
|------|-------|----------|-------|
|      |       |          |       |
|      |       |          |       |
|      |       |          |       |

---

## Summary

**Total Pages Tested:** ___ / 9  
**Total Checks Passed:** ___ / ___  
**Critical Issues:** ___  
**Minor Issues:** ___  

**Overall Status:** ✅ PASS / ⚠️ PASS WITH ISSUES / ❌ FAIL

**Validator Signature:** _____________  
**Date:** _____________
