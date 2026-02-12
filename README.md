# Mission Control

Real-time dashboard for monitoring and orchestrating OpenClaw agents.

![Mission Control](https://img.shields.io/badge/Version-1.0.0--mvp-orange)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

## Features

- **Dashboard** - Overview cards, activity feed, quick stats
- **Agents Panel** - Monitor all 6 agents (main, dev, ops, school, research, meta)
- **Kanban Board** - Task management with drag-and-drop
- **Cost Tracker** - Track spending across all providers
- **Cron Monitor** - View and manage scheduled jobs
- **Sessions Viewer** - Inspect active sessions and history

## Quick Start

```bash
# Install dependencies
npm install

# Create .env.local (copy from template or set manually)
echo "OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789" >> .env.local
echo "OPENCLAW_GATEWAY_TOKEN=<your-token>" >> .env.local
echo "NEXT_PUBLIC_OPENCLAW_GATEWAY_TOKEN=<your-token>" >> .env.local

# Start development server
PORT=3333 npm run dev

# Open http://localhost:3333
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENCLAW_GATEWAY_URL` | WebSocket URL for gateway | `ws://127.0.0.1:18789` |
| `OPENCLAW_GATEWAY_TOKEN` | Authentication token | Required |
| `NEXT_PUBLIC_OPENCLAW_GATEWAY_TOKEN` | Token for client-side | Required |
| `MISSION_CONTROL_PORT` | Server port | `3333` |

### Gateway Token

Get your token from `~/.openclaw/openclaw.json`:

```bash
jq -r '.gateway.auth.token' ~/.openclaw/openclaw.json
```

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: Tailwind CSS + shadcn/ui
- **State**: Zustand
- **Database**: SQLite (better-sqlite3)
- **Real-time**: WebSocket

## Project Structure

```
mission-control/
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── agents/       # Agents panel
│   │   ├── kanban/       # Kanban board
│   │   ├── costs/        # Cost tracker
│   │   ├── cron/         # Cron monitor
│   │   ├── sessions/     # Sessions viewer
│   │   ├── settings/     # Settings page
│   │   └── api/          # API routes
│   ├── components/       # React components
│   ├── lib/              # Utilities (db, gateway)
│   ├── stores/           # Zustand stores
│   └── types/            # TypeScript types
├── data/                 # SQLite database
└── public/               # Static assets
```

## Development

```bash
# Run development server
PORT=3333 npm run dev

# Build for production
npm run build

# Start production server
PORT=3333 npm start

# Lint
npm run lint
```

## API Routes

| Route | Description |
|-------|-------------|
| `POST /api/gateway` | Proxy to OpenClaw gateway |
| `GET/POST/PATCH/DELETE /api/tasks` | Kanban task CRUD |
| `GET /api/costs` | Cost aggregation (codexbar) |

## Keyboard Shortcuts

- `Ctrl+K` - Quick search (planned)
- `R` - Refresh current view

## License

Private/Internal use only.

---

Built for [OpenClaw](https://openclaw.ai) by Meta agent during 24-hour autonomous sprint.
