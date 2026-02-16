# Mission Control Architecture

## Overview

Mission Control is a Next.js WebUI for managing OpenClaw agents, tasks, crons, sessions, and costs. It shares a SQLite database with the `oc-tasks` CLI and connects to the OpenClaw gateway via WebSocket.

```
┌─────────────────────────────────────────────────────┐
│                   Mission Control                    │
│                  (Next.js :3333)                     │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Dashboard │  │  Kanban  │  │ Agent Monitor    │  │
│  │ (costs,  │  │ (tasks)  │  │ (sessions, logs) │  │
│  │ activity)│  │          │  │                  │  │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │
│       │              │                 │             │
│  ┌────┴──────────────┴─────────────────┴──────────┐ │
│  │              API Routes (/api/*)                │ │
│  └────┬──────────────┬─────────────────┬──────────┘ │
└───────┼──────────────┼─────────────────┼────────────┘
        │              │                 │
   ┌────▼────┐   ┌────▼────┐     ┌─────▼──────┐
   │ SQLite  │   │ Gateway │     │  codexbar  │
   │ tasks.db│   │  WS/API │     │  (costs)   │
   └─────────┘   └─────────┘     └────────────┘
```

## Stack

- **Runtime:** Next.js 15 (App Router) + TypeScript
- **UI:** Tailwind CSS + shadcn/ui (components.json present)
- **Database:** SQLite via `better-sqlite3` (shared with oc-tasks CLI)
- **Gateway connection:** WebSocket proxy to `localhost:18789`
- **Cost data:** `codexbar cost` CLI (text/JSON output)
- **Service:** systemd user unit (`mission-control.service`)

## Key Directories

```
~/codeWS/Projects/mission-control/
├── src/
│   ├── app/
│   │   ├── api/           # API routes (see oc-tasks-api.md)
│   │   ├── dashboard/     # Main dashboard page
│   │   ├── kanban/        # Task kanban board
│   │   ├── agents/        # Agent monitoring
│   │   ├── sessions/      # Session viewer
│   │   ├── crons/         # Cron management
│   │   └── analytics/     # Analytics/debugging
│   ├── components/        # Shared UI components
│   └── lib/               # Utilities, DB connection, types
├── docs/                  # This directory
├── server.ts              # Custom server entry
├── .env.local             # OPENCLAW_GATEWAY_TOKEN (must match openclaw.json)
└── data/                  # Any local data
```

## Authentication

- Gateway token in `.env.local` (`OPENCLAW_GATEWAY_TOKEN`)
- **Must be manually updated** when gateway rotates tokens
- MC connects via `ws://localhost:18789` (allowInsecureAuth=true required for local WS)
- No user-facing auth currently (LAN-only access assumed)

## Database Sharing

MC and `oc-tasks` CLI share the same SQLite database at `~/.openclaw/data/tasks.db`. Both can read/write. The CLI is the source of truth for schema migrations. MC should:

1. Never run its own migrations on the tasks DB
2. Handle schema additions gracefully (ignore unknown columns)
3. Use WAL mode for concurrent access (SQLite default)

## Gateway Integration

MC proxies some operations through the OpenClaw gateway WebSocket:
- Agent status/sessions
- Cron management (requires `operator.read` scope)
- Session operations

Other operations go directly to the SQLite database or shell exec:
- Task CRUD
- Task classification (calls oc-tasks internally)
- Cost queries (calls codexbar CLI)

## Deployment

```bash
# Service management
systemctl --user start mission-control
systemctl --user stop mission-control
systemctl --user restart mission-control
systemctl --user status mission-control

# Logs
journalctl --user -u mission-control -f

# Manual start (dev)
cd ~/codeWS/Projects/mission-control
npm run dev
```

Serves on `0.0.0.0:3333` (accessible on LAN).
