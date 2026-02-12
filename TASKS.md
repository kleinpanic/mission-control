# Mission Control - Task List

## P1 - Dashboard (High Priority)
- [ ] Fix timestamps showing "never" / heartbeat "null" — get real lastActivity from sessions
- [ ] Add Next Heartbeat preview + skip/trigger button (use `wake` WebSocket method)
- [ ] Add Next Cron preview (show next scheduled job from cron.list)

## P2 - Cost Tracker
- [ ] Add daily/weekly/monthly cost charts (recharts or similar)
- [ ] Add trends visualization with actual graphs

## P3 - Other Features
- [ ] Kanban: verify New Task works, fix zeros
- [ ] Settings: add model selection per agent (use config.get/config.set)
- [ ] Cron: add caching for better performance

## Completed
- [x] GatewayProvider with WebSocket handshake (Protocol v3)
- [x] Dashboard using live `status`, `usage.cost`, `cron.list`
- [x] Real-time event subscriptions (agent, heartbeat, cron, health)
- [x] Compact Session button via `sessions.compact`
- [x] Light/Dark/System theme toggle
- [x] Analytics page with log viewer
- [x] Fixed WebSocket env variable name
- [x] Fixed agent display (6 agents showing)

## Notes
- WebSocket spec: `~/.openclaw/workspace-meta/projects/mission-control/WEBSOCKET-SPEC.md`
- Dev server: `PORT=3333 npm run dev`
- Build check: `npm run build`
