import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFinaClient } from './client.js';

const fakeFetch = (status, body, seen = {}) => async (url, init) => {
  seen.url = String(url);
  seen.auth = init.headers.Authorization;
  return { ok: status < 400, status, json: async () => body };
};

test('sends the key as Bearer and drops empty params', async () => {
  const seen = {};
  const c = createFinaClient({ baseUrl: 'https://fina.example/api/', apiKey: 'fk_x', fetchImpl: fakeFetch(200, { ok: 1 }, seen) });
  assert.deepEqual(await c.get('/ai/transactions', { q: 'קפה', category: undefined, limit: 5 }), { ok: 1 });
  assert.equal(seen.auth, 'Bearer fk_x');
  assert.equal(seen.url, 'https://fina.example/api/ai/transactions?q=%D7%A7%D7%A4%D7%94&limit=5');
});

test('writes send JSON + the CSRF header Fina requires', async () => {
  let init;
  const c = createFinaClient({ baseUrl: 'https://fina.example/api', apiKey: 'fk_x', fetchImpl: async (u, i) => { init = i; return { ok: true, status: 200, json: async () => ({ updated: 2 }) }; } });
  assert.deepEqual(await c.post('/ai/categorize/merchant-name', { currentName: 'A', newName: 'B' }), { updated: 2 });
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['X-Fina-Client'], 'web-app');
  assert.deepEqual(JSON.parse(init.body), { currentName: 'A', newName: 'B' });
});

test('maps 401 to a clear Hebrew instruction', async () => {
  const c = createFinaClient({ baseUrl: 'https://fina.example/api', apiKey: 'fk_x', fetchImpl: fakeFetch(401, {}) });
  await assert.rejects(c.get('/ai/overview'), /מפתח ה-AI לא תקין/);
});

test('refuses plain-http remote URLs and missing config', async () => {
  await assert.rejects(createFinaClient({ baseUrl: 'http://evil.example/api', apiKey: 'fk_x', fetchImpl: fakeFetch(200, {}) }).get('/ai/overview'), /https/);
  await assert.rejects(createFinaClient({}).get('/ai/overview'), /FINA_API_URL/);
});
