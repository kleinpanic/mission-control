# Mission Control - Autonomous Work Progress

## Status: IN_PROGRESS

## Session: auto-1770952335  
Started: 2026-02-12T22:12:15-05:00
Current: Phase 2 - Data Display Fixes

## Critical Fix - COMPLETE ✅

**Root Cause:** `crypto.randomUUID()` fails in non-secure HTTP contexts (only works on HTTPS or localhost).  
**Impact:** ALL WebSocket requests failed → empty dashboards, agents, costs, sessions.  
**Solution:** Added fallback to timestamp+random for HTTP contexts.  
**Result:** Klein confirmed "a lot better" - data now loading!

**Commits:**
- `fa09c8a` - crypto.randomUUID fallback for non-secure contexts  
- `e1d6ca3` - Use WebSocket proxy for remote LAN access
- `93a4160` - WebSocket proxy text frame fix

## Remaining Issues (Klein's Feedback - 2026-02-14 02:54 EST)

### P0: Data Display Issues
- [x] **Costs page:** "cost by agent", "by provider", "By Model" show no data (only "Cost By Model" works)
- [x] **Cron page:** Shows "10 total, 10 active, 0 disabled" - should show disabled crons (FIXED: added --all flag - 76be168)
- [x] **Settings:** All agents show "default: gpt-5.2" (wrong default model) (FIXED: fetch from gateway config - 26e612b)
- [ ] **Settings:** Connected channels shows nothing (should show Slack, WhatsApp, etc.)
- [ ] **Analytics:** Shows "4 errors" - investigate

### P1: Functionality Fixes
- [ ] **Sessions compaction:** "11 eligible" → ran → "0 compacted" (didn't work)
- [ ] **Agent status contradictions:**
  - Dev shows "disabled" heartbeat but also "waiting" status
  - Meta shows "waiting" but shouldn't be doing anything
- [ ] **Session cleanup:** 55 total sessions - needs cleanup

### P2: UI/UX Improvements
- [ ] **Kanban:** UI "kinda shitty looking now" - needs visual polish
- [ ] **Cost breakdown ideas:** 
  - API vs OAuth breakdown
  - API services (nano-banana, embedding, etc.)
  - Crons vs heartbeats vs actual chats

### P3: Enhancements
- [ ] Better cost visualization (breakdown by usage type)
- [ ] Session auto-cleanup policies
- [ ] Model dropdown on task cards (defaults to recommendedModel)

## Next Steps

1. **Investigate cost data structure** - why only "Cost By Model" works
2. **Fix cron list filtering** - include disabled crons
3. **Fix settings default model** - read from actual gateway config
4. **Fix agent status logic** - resolve disabled/waiting contradiction
5. **Implement working session compaction** - actually compact the eligible sessions
6. **Polish Kanban UI** - improve visual design

## Files Modified
- `src/providers/GatewayProvider.tsx` - crypto.randomUUID fix + proxy routing
- `server.ts` - WebSocket proxy text frame fix
- `.env.local` - Removed hardcoded WireGuard URL

## Evidence
Klein's message: "Wow.... you rlly did it gang... a lot better.."  
Critical blocker resolved ✅ - Now tackling data display issues.
