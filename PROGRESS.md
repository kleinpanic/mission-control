# Mission Control - Autonomous Work Progress

## Status: IN_PROGRESS

## Session: auto-1770952335  
Started: 2026-02-12T22:12:15-05:00
Current: Phase 2 - Data Display Fixes + Investigation

## Critical Fix - COMPLETE ✅

**Root Cause:** `crypto.randomUUID()` fails in non-secure HTTP contexts (only works on HTTPS or localhost).  
**Impact:** ALL WebSocket requests failed → empty dashboards, agents, costs, sessions.  
**Solution:** Added fallback to timestamp+random for HTTP contexts.  
**Result:** Klein confirmed "a lot better" - data now loading from localhost! ✅

**Commits:**
- `fa09c8a` - crypto.randomUUID fallback for non-secure contexts  
- `e1d6ca3` - Use WebSocket proxy for remote LAN access
- `93a4160` - WebSocket proxy text frame fix
- `cbb57cd` - Forward Origin header through proxy for auth
- `29a72f9` - docs update
- `d5f5b8d` - Fix cost breakdowns (use historyData)

## Issues - Klein's Feedback (2026-02-14 02:54 EST)

### ✅ FIXED
- [x] **Cost breakdowns empty** - Fixed by using `historyData.byProvider` and `historyData.byModel` instead of empty `summary` fields

### 🔄 IN PROGRESS
- [ ] **Cron counts** - Shows "10 total, 10 active, 0 disabled" but should show disabled crons
- [ ] **Session compaction** - "11 eligible" → ran → "0 compacted" (didn't actually compact)
- [ ] **Agent status bugs**:
  - Dev shows "disabled" heartbeat but also "waiting" status
  - Meta shows "waiting" but shouldn't be doing anything

### 📋 TODO
- [ ] **Cost by Agent** - Empty (requires session log parsing - known limitation, not a bug)
- [ ] **Settings page**:
  - All agents show "default: gpt-5.2" (wrong default model)
  - Connected channels shows nothing (should show Slack, WhatsApp, etc.)
- [ ] **Analytics** - Shows "4 errors" - investigate
- [ ] **Session cleanup** - 55 total sessions need cleanup
- [ ] **Kanban UI** - Visual polish needed

## Technical Notes

**Localhost vs LAN access:**
- Klein accesses via `localhost:3333` (works perfectly ✅)
- LAN access (`10.0.0.27:3333`) hits WebSocket origin rejection
- Proxy Origin forwarding fixed but Klein doesn't use LAN access

**Cost data sources:**
- `/api/costs` → calls `codexbar cost --provider all --pretty` → returns empty data (no usage records)
- `/api/costs/history` → calls `codexbar cost --provider all --format json` → aggregates and returns actual data
- Fix: Use historyData for breakdowns instead of summary

**Known limitations:**
- Cost by Agent requires session log parsing (not implemented yet)
- Agent-level cost tracking would need separate aggregation logic

## Next Steps

1. Investigate cron list endpoint - why disabled crons aren't showing
2. Debug session compaction - why it reports 0 compacted
3. Fix settings page default model display
4. Fix settings connected channels display
5. Check analytics errors
6. Implement session cleanup logic
7. Polish Kanban UI

## Files Modified
- `src/providers/GatewayProvider.tsx` - crypto.randomUUID fix + proxy routing
- `server.ts` - WebSocket proxy text frame fix + Origin forwarding
- `src/app/costs/page.tsx` - Use historyData for cost breakdowns
- `.env.local` - Removed hardcoded WireGuard URL

## Evidence
Klein's message: "Wow.... you rlly did it gang... a lot better.."  
Critical blocker resolved ✅ - Dashboard loads from localhost  
Cost breakdown fix committed - awaiting verification
