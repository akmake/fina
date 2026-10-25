#!/usr/bin/env node
/**
 * Fina MCP server — lets an AI assistant (Claude Desktop / Claude Code / any MCP
 * client) answer questions about your money: "how much did we spend on
 * restaurants this month?", "what came in yesterday?", "which bank needs attention?".
 *
 * READ-ONLY by design: it calls Fina's /api/ai/* endpoints with a personal AI key
 * (created in Fina → Settings), which the server accepts for GET requests only.
 *
 * Env:
 *   FINA_API_URL  e.g. https://ziporiteem.com/api   (no trailing slash needed)
 *   FINA_API_KEY  fk_…  (Fina → הגדרות → חיבור לעוזר AI)
 *
 * Transport: stdio. Contract: docs/modules/ai-mcp.md in the Fina repo.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createFinaClient } from './client.js';

const client = createFinaClient({
  baseUrl: process.env.FINA_API_URL,
  apiKey: process.env.FINA_API_KEY,
});

const server = new McpServer({ name: 'fina', version: '1.0.0' });

// Every tool returns the API JSON as text; errors become readable tool errors.
const asTool = (fn) => async (args) => {
  try {
    const data = await fn(args);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  } catch (err) {
    return { isError: true, content: [{ type: 'text', text: err.message }] };
  }
};

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).describe('Month as YYYY-MM (Israel time). Omit for the current month.');
const day = (what) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe(`${what} date, YYYY-MM-DD (Israel time)`);

server.registerTool(
  'get_month_overview',
  {
    title: 'Month overview',
    description: 'Income, expenses, net, top spending categories, budget usage per category, bank-connection health and unread alert count for one month. Amounts are in ILS. Start here for general questions about the household finances.',
    inputSchema: { month: month.optional() },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  asTool(({ month: m }) => client.get('/ai/overview', { month: m })),
);

server.registerTool(
  'search_transactions',
  {
    title: 'Search transactions',
    description: 'Find individual transactions, newest first. Filter by text in the merchant/description, category, income vs expense, amount range and date range. Returns up to `limit` rows (max 200) plus the total match count.',
    inputSchema: {
      query: z.string().max(100).optional().describe('Text to look for in the description / merchant name (literal match, Hebrew or English)'),
      category: z.string().optional().describe('Exact category name, e.g. "מסעדות"'),
      type: z.enum(['income', 'expense']).optional(),
      from: day('Start').optional(),
      to: day('End (inclusive)').optional(),
      minAmount: z.number().nonnegative().optional(),
      maxAmount: z.number().nonnegative().optional(),
      limit: z.number().int().min(1).max(200).optional().describe('Default 50'),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  asTool(({ query, ...rest }) => client.get('/ai/transactions', { q: query, ...rest })),
);

server.registerTool(
  'spending_breakdown',
  {
    title: 'Spending breakdown',
    description: 'Totals grouped by category, by month, or by merchant over a date range (default: the last ~3 months). Use type="income" for income. Good for "where does our money go" and month-over-month comparisons.',
    inputSchema: {
      groupBy: z.enum(['category', 'month', 'merchant']).default('category'),
      type: z.enum(['expense', 'income']).default('expense'),
      from: day('Start').optional(),
      to: day('End (inclusive)').optional(),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  asTool((args) => client.get('/ai/spending', args)),
);

server.registerTool(
  'connection_status',
  {
    title: 'Bank connection status',
    description: 'Each connected bank / credit card: whether automatic daily sync is on and at what hour, last sync time and result, problems that need the user (e.g. wrong password), and whether a sync is waiting for an SMS code right now.',
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  asTool(() => client.get('/ai/connections')),
);

server.registerTool(
  'list_alerts',
  {
    title: 'Unread alerts',
    description: 'Unread alerts from Fina (budget thresholds, failed syncs, etc.), newest first.',
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  asTool(() => client.get('/ai/alerts')),
);

if (!client.configured) {
  // Still start, so the client shows a clear tool error instead of a dead server.
  console.error('[fina-mcp] FINA_API_URL and FINA_API_KEY must be set — see mcp/README.md');
}

await server.connect(new StdioServerTransport());
