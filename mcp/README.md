# Fina MCP server

Lets an AI assistant (Claude Desktop, Claude Code, or any MCP client) answer
questions about your Fina finances — *"how much did we spend on restaurants this
month?"*, *"what came in yesterday?"*, *"which bank connection needs attention?"*.

**Read-only.** It uses a personal AI key that Fina accepts for `GET /api/ai/*`
only — the assistant can never change or delete anything. Note that whatever the
assistant reads is sent to the AI provider.

## Tools

| Tool | What it answers |
|------|-----------------|
| `get_month_overview` | Income, expenses, net, top categories, budget usage, connection health, unread alerts (`month` = YYYY-MM, default current) |
| `search_transactions` | Individual transactions by text / category / income-expense / amount / dates (max 200) |
| `spending_breakdown` | Totals by `category`, `month` or `merchant` over a date range |
| `connection_status` | Each bank/card: daily sync hour, last sync, problems, waiting for an SMS code |
| `list_alerts` | Unread Fina alerts |

## Setup

1. `cd mcp && npm install` (Node 18+).
2. In Fina: **הגדרות → חיבור לעוזר AI → יצירת מפתח**. Copy the key (`fk_…`) — it is shown once.
   The same screen shows ready-made snippets for the two clients below.

**Claude Code**

```bash
claude mcp add fina -e FINA_API_URL=https://<your-fina>/api -e FINA_API_KEY=fk_... -- node C:/path/to/fina/mcp/index.js
```

**Claude Desktop** — add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "fina": {
      "command": "node",
      "args": ["C:/path/to/fina/mcp/index.js"],
      "env": { "FINA_API_URL": "https://<your-fina>/api", "FINA_API_KEY": "fk_..." }
    }
  }
}
```

`FINA_API_URL` must be `https://` (plain `http://` is allowed only for `localhost`).
Revoke a key any time in the same Fina screen — it stops working immediately.

## Develop

`npm test` runs the HTTP-client unit tests. The API contract lives in
`docs/modules/ai-mcp.md`; server code in `server/controllers/aiController.js`.
