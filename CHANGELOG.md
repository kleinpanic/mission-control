# Changelog

## [0.2.0] - 2026-02-15

### Added
- **Auth mode badges** on agent cards (OAuth/API/Token/Local indicators)
- **Rate limit visibility** per agent with cooldown timers and provider details
- **Interactive channel settings** with expandable cards, agent routing display, raw config viewer
- **Personal tasks panel** on kanban (collapsible, hidden by default, "Move to Agent Board" action)
- **Task search and filtering** on kanban board
- **Quick add** natural language task entry
- **Task pause endpoint** (`/api/tasks/pause`) that stops autonomous sessions
- **Task dispatch** to agents via kanban UI
- **CI/CD pipelines** (lint/typecheck, test, build on PR; release on tag; deploy on release)
- **Systemd service** for persistent server with auto-restart
- **Remote LAN access** (0.0.0.0 binding, configurable WS proxy)

### Fixed
- Dashboard costs showing $0 (codexbar PATH resolution in server context)
- Task stats showing 0 daily/weekly (wrong status filter: `done` → `completed`)
- Agent cards showing no data (switched from WS to HTTP `/api/agents` for enriched runtime data)
- Kanban columns not filling full height (flex-grow behavior)
- Recent Activity missing detail (agent names, event types, timestamps)
- Analytics page errors confirmed as real gateway log errors (not UI bugs)
- Personal tasks leaking into agent kanban (list filter separation)
- `oc-tasks next` now excludes personal tasks from agent pickup

### Changed
- Kanban only shows `agents` and `shared` list tasks by default
- Task stats use `statusChangedAt` instead of `completedAt` for accuracy
- ESLint warnings reduced from 253 to 194 (removed unused code, dead files, unused deps)
- Cost API uses text output as primary source with JSON fallback

## [0.1.0] - 2026-02-13

### Added
- Initial Mission Control dashboard
- Agent monitoring with WebSocket gateway connection
- Kanban task management (shared database with oc-tasks)
- Cost tracking via codexbar
- Cron job management
- Session viewer
- Analytics and debugging page
