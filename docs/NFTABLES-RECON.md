# NFTables Recon — broklein (Mission Control Host)

**Date:** 2026-02-17  
**Host:** broklein (Debian 13, kernel 6.12.63)

## Network Interfaces

| Interface | IP | Role |
|-----------|-----|------|
| `wlp0s20f3` | `10.0.0.27/24` | LAN WiFi |
| `wg-openclaw` | `10.70.40.2/32` | OpenClaw WireGuard VPN |
| `wg-backup` | `10.88.78.11/32` | Backup WireGuard |
| `wg-lan` | `10.44.0.2/24` | LAN WireGuard |
| `wg-rsync` | `10.88.77.4/32` | Rsync WireGuard |
| Docker bridges | `172.17-21.x.x` | Docker networks |

## File Layout

| File | Purpose | Loaded? |
|------|---------|---------|
| `/etc/nftables.conf` | Base ruleset (Docker filter/nat tables) | **Yes** — loaded on `systemctl start nftables` |
| `/etc/nftables.d/40-docker.nft` | Docker bridge forwarding (inet filter) | **No** — not included by `/etc/nftables.conf` |
| `/etc/nftables.d/50-torrents.nft` | Torrent host firewall (inet host table, INPUT policy drop) | **No** — not included by `/etc/nftables.conf` |

**Key finding:** `/etc/nftables.conf` does **NOT** include `/etc/nftables.d/*.nft`. The `.d/` files exist but are dormant unless manually loaded.

## Live Ruleset Summary

The live ruleset is primarily managed by Docker's `iptables-nft` backend. User-defined rules exist in:

### `table ip filter`
- **INPUT:** `policy accept` (empty chain — all ports open)
- **FORWARD:** `policy drop` + Docker chains
- **OUTPUT:** `policy accept`
- **DOCKER-USER:** Allows `10.0.0.0/24` on `wlp0s20f3` for tcp/8080, drops other WAN sources for 8080

### `table ip nat`
- DNAT rules for Docker containers (8080 → 172.19.0.3, 2222 → 172.21.0.2:22, 3000 → 172.21.0.2)
- Masquerade for Docker networks + loopback masquerade for port 18789

### `table ip raw`
- Blocks direct access to Docker IPs from non-bridge interfaces
- Blocks non-loopback access to 127.0.0.1:8080

## Mission Control Port Exposure

| Port | Service | Binding | Firewall Status |
|------|---------|---------|-----------------|
| 3333 | Next.js HTTP | `0.0.0.0:3333` | **OPEN** (no INPUT rules block it) |
| 9999 | WS Proxy | `0.0.0.0:9999` | **OPEN** (no INPUT rules block it) |
| 18789 | OpenClaw Gateway | `127.0.0.1` + `10.70.40.2` | Loopback + WireGuard only |

## ⚠️ Security Note

If `50-torrents.nft` were loaded (e.g., via `nft -f`), it would enforce `inet host` INPUT with `policy drop`, only allowing:
- Established/related
- Loopback, ICMP
- LAN SSH (22), torrent (56881), filebrowser (8080)

**Ports 3333 and 9999 would be BLOCKED** from LAN if `50-torrents.nft` is loaded.  
If you want to harden the host while keeping Mission Control accessible, add these to `50-torrents.nft` → `chain input`:

```nft
# Mission Control (HTTP + WS proxy)
iifname @lan_ifaces ip saddr @lan_subnet_v4 tcp dport { 3333, 9999 } accept
```

## Issue 2 Recon: Remote WS "Connecting" Hang

### Eliminated Causes
- **Firewall:** Ports 3333 and 9999 are open (INPUT policy accept, no blocking rules)
- **Gateway `unauthorizedHttpsAccess`:** Irrelevant — controls token requirement for web UI, already configured
- **Origin header:** The proxy always sends `http://localhost:3333` as Origin to gateway (doesn't vary by client)
- **Mixed content:** Both HTTP and WS are insecure, no browser blocking

### Remaining Investigation Areas
1. **Gateway connect.challenge timing:** If the gateway delays or doesn't send `connect.challenge` for proxy-initiated connections, the browser hangs waiting. Added diagnostic logging to track this.
2. **Device auth nonce signing:** The nonce is captured from `connect.challenge` event. If the event is dropped or arrives after the client's `connect` request, `connectNonce` would be `null`, producing a v1 signature where gateway expects v2. This would cause silent auth rejection.
3. **Multiple proxy instances:** There are ~4 old `server.ts` processes still running (from before port 3333 binding). These may be capturing connections on ports they're listening on, preventing the current instance from handling them. **Action needed:** Kill stale processes.
4. **Health check:** Added `GET http://<host>:9999/health` endpoint for remote diagnostics.

### Recommended Next Steps
1. Kill stale server processes: `pkill -f "tsx server.ts" && <restart clean>`
2. From remote machine, test: `curl http://10.0.0.27:9999/health`
3. Check server logs when remote client connects for diagnostic output
4. Open browser dev console on remote machine → Network tab → WS connection to see if upgrade succeeds
