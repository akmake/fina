#!/usr/bin/env node
/**
 * Fina MCP server — lets an AI assistant (Claude Desktop / Claude Code / any MCP
 * client) answer questions about your money: "how much did we spend on
 * restaurants this month?", "what came in yesterday?", "which bank needs attention?".
 *
 * It calls Fina's /api/ai/* endpoints with a personal AI key (Fina → Settings).
 * Reading works with any key. Renaming merchants / changing categories works only
 * with a key created with the "שינוי שמות וקטגוריות" permission — nothing else
 * (no deletes, no money movements, no settings) is exposed.
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

// ── Categorization (needs a key created with "שינוי שמות וקטגוריות") ─────────
// Changes apply to all matching transactions AND are learned for future imports.
// Use dryRun first when the user hasn't confirmed the exact change.

const writeHints = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };

server.registerTool(
  'list_categories',
  {
    title: 'List categories',
    description: 'All category names in use, most-used first. Call this before changing categories so you use an existing name exactly.',
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  asTool(() => client.get('/ai/categories')),
);

server.registerTool(
  'rename_merchant',
  {
    title: 'Rename a merchant',
    description: 'Give a merchant a clean display name on ALL its transactions (e.g. "PAYPAL *NETFLIX.COM 402…" → "נטפליקס"). Fina also learns it, so future imports of that merchant arrive with the new name. `currentName` must match the description exactly as returned by search_transactions. Set dryRun=true to see how many transactions would change.',
    inputSchema: {
      currentName: z.string().min(1).max(80),
      newName: z.string().min(1).max(80),
      dryRun: z.boolean().optional(),
    },
    annotations: writeHints,
  },
  asTool((args) => client.post('/ai/categorize/merchant-name', args)),
);

server.registerTool(
  'set_merchant_category',
  {
    title: 'Set a merchant’s category',
    description: 'Move ALL transactions of a merchant to a category, and learn it for future imports. `merchant` = the exact description from search_transactions. The category must exist (see list_categories) unless createIfMissing=true. Use dryRun=true to preview.',
    inputSchema: {
      merchant: z.string().min(1).max(80),
      category: z.string().min(1).max(80),
      createIfMissing: z.boolean().optional(),
      dryRun: z.boolean().optional(),
    },
    annotations: writeHints,
  },
  asTool((args) => client.post('/ai/categorize/merchant-category', args)),
);

server.registerTool(
  'set_transaction_category',
  {
    title: 'Set one transaction’s category',
    description: 'Change the category of a single transaction (a one-off correction, nothing is learned). `transactionId` is the `id` from search_transactions. Returns the previous category so it can be undone.',
    inputSchema: {
      transactionId: z.string().min(1),
      category: z.string().min(1).max(80),
      createIfMissing: z.boolean().optional(),
    },
    annotations: writeHints,
  },
  asTool((args) => client.post('/ai/categorize/transaction-category', args)),
);

server.registerTool(
  'rename_category',
  {
    title: 'Rename a category',
    description: 'Rename a category everywhere: its transactions, budgets, recurring items and goals that track it. Refuses if the new name already exists (to merge, move merchants with set_merchant_category instead). Use dryRun=true to preview.',
    inputSchema: {
      currentName: z.string().min(1).max(80),
      newName: z.string().min(1).max(80),
      dryRun: z.boolean().optional(),
    },
    annotations: writeHints,
  },
  asTool((args) => client.post('/ai/categorize/rename-category', args)),
);

if (!client.configured) {
  // Still start, so the client shows a clear tool error instead of a dead server.
  console.error('[fina-mcp] FINA_API_URL and FINA_API_KEY must be set — see mcp/README.md');
}

await server.connect(new StdioServerTransport());
