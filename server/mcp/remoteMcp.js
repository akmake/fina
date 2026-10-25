import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import {
  overview, searchTransactions, spending, connections, alerts, categories,
  renameMerchant, setMerchantCategory, setTransactionCategory, renameCategory,
} from '../controllers/aiController.js';

/**
 * Remote MCP endpoint for web assistants (ChatGPT connectors, Claude.ai custom
 * connectors): https://<fina>/api/mcp/<fk_ AI key>  — Streamable HTTP, stateless.
 *
 * The key travels in the URL because those clients can't send a custom header
 * (app.js strips it from req.url before any logger sees it). Every tool runs the
 * SAME handler as /api/ai/* (aiController) on the already-authenticated request,
 * so scoping, validation and audit are identical. Write tools need the key's
 * 'categorize' scope and are refused for household viewers.
 * Contract: docs/modules/ai-mcp.md § Remote MCP.
 */

// Run an Express handler from aiController and get its JSON (or throw its error).
const callHandler = (handler, baseReq, { query = {}, body = {} } = {}) => new Promise((resolve, reject) => {
  const req = Object.assign(Object.create(baseReq), { query, body });
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) {
      if (this.statusCode >= 400) reject(new Error(payload?.message || `שגיאה (${this.statusCode})`));
      else resolve(payload);
    },
  };
  Promise.resolve(handler(req, res, (err) => reject(err || new Error('שגיאה')))).catch(reject);
});

const text = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
const fail = (err) => ({ isError: true, content: [{ type: 'text', text: err.message }] });
const run = (fn) => async (args) => { try { return text(await fn(args || {})); } catch (err) { return fail(err); } };

const READ = { readOnlyHint: true, openWorldHint: false };
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).describe('YYYY-MM, Israel time. Omit for the current month.');
const day = (what) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe(`${what} date, YYYY-MM-DD`);

const buildServer = (req) => {
  const server = new McpServer({ name: 'fina', version: '1.0.0' });
  const canWrite = () => {
    if (!req.apiKey?.scopes?.includes('categorize')) {
      throw new Error('למפתח הזה אין הרשאה לשנות שמות וקטגוריות. ב־Fina: הגדרות ← חיבור לעוזר AI ← צור מפתח עם ההרשאה.');
    }
    if (req.member?.role === 'viewer') throw new Error('לצופה במשק הבית אין הרשאת שינוי');
  };
  const write = (handler) => run(async (args) => { canWrite(); return callHandler(handler, req, { body: args }); });

  server.registerTool('get_month_overview', {
    title: 'Month overview',
    description: 'Income, expenses, net, top spending categories, budget usage, bank-connection health and unread alerts for one month (ILS). Start here for general questions about the household finances.',
    inputSchema: { month: month.optional() }, annotations: READ,
  }, run(({ month: m }) => callHandler(overview, req, { query: { month: m } })));

  server.registerTool('search_transactions', {
    title: 'Search transactions',
    description: 'Find transactions, newest first, by text in the merchant/description, category, income/expense, amount and date range. Returns up to `limit` (max 200) plus the total count. Each row has an `id` (for set_transaction_category).',
    inputSchema: {
      query: z.string().max(100).optional(), category: z.string().optional(), type: z.enum(['income', 'expense']).optional(),
      from: day('Start').optional(), to: day('End (inclusive)').optional(),
      minAmount: z.number().nonnegative().optional(), maxAmount: z.number().nonnegative().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }, annotations: READ,
  }, run(({ query, ...rest }) => callHandler(searchTransactions, req, { query: { q: query, ...rest } })));

  server.registerTool('spending_breakdown', {
    title: 'Spending breakdown',
    description: 'Totals grouped by category, month or merchant over a date range (default ≈ last 3 months). type="income" for income.',
    inputSchema: {
      groupBy: z.enum(['category', 'month', 'merchant']).optional(), type: z.enum(['expense', 'income']).optional(),
      from: day('Start').optional(), to: day('End (inclusive)').optional(),
    }, annotations: READ,
  }, run((args) => callHandler(spending, req, { query: args })));

  server.registerTool('connection_status', {
    title: 'Bank connection status',
    description: 'Each connected bank/credit card: daily sync hour, last sync and result, problems needing the user, and whether a sync is waiting for an SMS code.',
    inputSchema: {}, annotations: READ,
  }, run(() => callHandler(connections, req)));

  server.registerTool('list_alerts', {
    title: 'Unread alerts', description: 'Unread Fina alerts, newest first.', inputSchema: {}, annotations: READ,
  }, run(() => callHandler(alerts, req)));

  server.registerTool('list_categories', {
    title: 'List categories', description: 'Category names in use, most used first. Use these exact names when changing categories.',
    inputSchema: {}, annotations: READ,
  }, run(() => callHandler(categories, req)));

  server.registerTool('rename_merchant', {
    title: 'Rename a merchant',
    description: 'Give a merchant a clean name on ALL its transactions; Fina learns it for future imports. currentName = the exact description from search_transactions. dryRun=true previews the count.',
    inputSchema: { currentName: z.string().min(1).max(80), newName: z.string().min(1).max(80), dryRun: z.boolean().optional() },
    annotations: WRITE,
  }, write(renameMerchant));

  server.registerTool('set_merchant_category', {
    title: 'Set a merchant’s category',
    description: 'Move ALL of a merchant’s transactions to a category and learn it for future imports. The category must exist (list_categories) unless createIfMissing=true. dryRun=true previews.',
    inputSchema: { merchant: z.string().min(1).max(80), category: z.string().min(1).max(80), createIfMissing: z.boolean().optional(), dryRun: z.boolean().optional() },
    annotations: WRITE,
  }, write(setMerchantCategory));

  server.registerTool('set_transaction_category', {
    title: 'Set one transaction’s category',
    description: 'Change the category of one transaction (id from search_transactions). Returns the previous category for undo.',
    inputSchema: { transactionId: z.string().min(1), category: z.string().min(1).max(80), createIfMissing: z.boolean().optional() },
    annotations: WRITE,
  }, write(setTransactionCategory));

  server.registerTool('rename_category', {
    title: 'Rename a category',
    description: 'Rename a category everywhere (transactions, budgets, recurring, goals). Refuses if the new name exists. dryRun=true previews.',
    inputSchema: { currentName: z.string().min(1).max(80), newName: z.string().min(1).max(80), dryRun: z.boolean().optional() },
    annotations: WRITE,
  }, write(renameCategory));

  return server;
};

/** Express handler for /api/mcp (runs after apiKeyAuth + resolveHousehold). */
export const handleMcp = async (req, res) => {
  if (req.method !== 'POST') {
    // Stateless server: no standalone SSE stream / session to resume or delete.
    return res.status(405).set('Allow', 'POST').json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null });
  }
  const server = buildServer(req);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on('close', () => { transport.close(); server.close(); });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null });
  }
};
