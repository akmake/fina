> Last updated: 2026-03-12

# Real-Time / Socket Events

## Status: NOT IMPLEMENTED

This application currently uses **no WebSocket or real-time communication**.

All data communication is standard HTTP REST (request/response).
Client-side data refresh is achieved via:
- **TanStack React Query** automatic refetch on window focus
- **Manual refetch** after mutations
- No polling is configured

## If Real-Time Is Added in the Future

Recommended approach: **Socket.io** (matches the existing Node.js/Express stack).

Suggested events to implement:

| Event | Direction | Description |
|-------|-----------|-------------|
| `transaction:created` | Server → Client | New transaction added (e.g., from scraper) |
| `transaction:updated` | Server → Client | Transaction categorized or edited |
| `alert:triggered` | Server → Client | Budget/balance alert fired |
| `scrape:progress` | Server → Client | Bank scraper progress updates |
| `scrape:complete` | Server → Client | Scrape finished with results |

## Integration Points When Adding Sockets

1. Install `socket.io` on server, `socket.io-client` on client
2. Attach socket server to existing Express HTTP server in `server/app.js`
3. Add socket auth middleware (validate JWT cookie on handshake)
4. Update `client/src/utils/api.js` or create `client/src/utils/socket.js`
5. Update `docs/sync-map.md` — socket events are coupling points
