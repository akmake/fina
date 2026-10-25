import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import request from 'supertest';
import app from '../app.js';
import { registerApproved } from './helpers.js';

const CSRF = { 'X-Fina-Client': 'web-app' };
const REDIRECT = 'https://chatgpt.com/connector_platform_oauth_redirect';

const rpc = (token, body) => request(app).post('/api/mcp')
  .set('Authorization', `Bearer ${token}`).set('Accept', 'application/json, text/event-stream')
  .send({ jsonrpc: '2.0', id: 1, ...body });

describe('OAuth ל-MCP המרוחק (ChatGPT)', () => {
  it('גילוי → רישום → אישור → טוקן → MCP → רענון → ניתוק', async () => {
    // Unauthenticated MCP call points at the discovery document.
    const anon = await request(app).post('/api/mcp').send({});
    expect(anon.status).toBe(401);
    const rm = /resource_metadata="([^"]+)"/.exec(anon.headers['www-authenticate'])[1];
    const prm = await request(app).get(new URL(rm).pathname);
    expect(prm.body.resource).toMatch(/\/api\/mcp$/);
    const asm = await request(app).get(`/.well-known/oauth-authorization-server${new URL(prm.body.authorization_servers[0]).pathname}`);
    expect(asm.body).toMatchObject({ code_challenge_methods_supported: ['S256'] });
    expect(new URL((await request(app).get('/api/oauth/.well-known/openid-configuration')).body.token_endpoint).pathname).toBe('/api/oauth/token');

    // Only assistant hosts may register.
    expect((await request(app).post('/api/oauth/register').send({ redirect_uris: ['https://evil.example/cb'] })).status).toBe(400);
    const reg = await request(app).post('/api/oauth/register').send({ client_name: 'ChatGPT', redirect_uris: [REDIRECT] });
    expect(reg.status).toBe(201);
    const clientId = reg.body.client_id;

    const verifier = crypto.randomBytes(32).toString('base64url');
    const params = {
      response_type: 'code', client_id: clientId, redirect_uri: REDIRECT, state: 'st8',
      code_challenge: crypto.createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256',
      scope: 'read categorize',
    };
    const auth = await request(app).get('/api/oauth/authorize').query(params);
    expect(auth.status).toBe(302);
    expect(auth.headers.location).toContain('/oauth/consent?');

    // The consent page needs a session.
    expect((await request(app).get('/api/oauth/consent').query(params)).status).toBe(401);
    const agent = request.agent(app);
    await registerApproved(agent, { email: 'oauth1@test.com' });
    const info = await agent.get('/api/oauth/consent').query(params);
    expect(info.body).toEqual({ clientName: 'ChatGPT', redirectHost: 'chatgpt.com', requestsCategorize: true });

    const decision = await agent.post('/api/oauth/consent').set(CSRF).send({ params, approve: true, allowCategorize: false });
    const back = new URL(decision.body.redirectTo);
    expect(back.origin + back.pathname).toBe(REDIRECT);
    expect(back.searchParams.get('state')).toBe('st8');
    const code = back.searchParams.get('code');

    // Wrong PKCE verifier burns nothing useful; the right one gets tokens (once).
    const exchange = (v) => request(app).post('/api/oauth/token').type('form')
      .send({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, client_id: clientId, code_verifier: v });
    const tok = await exchange(verifier);
    expect(tok.status).toBe(200);
    expect(tok.body).toMatchObject({ token_type: 'Bearer', scope: 'read' });
    expect((await exchange(verifier)).body.error).toBe('invalid_grant'); // single use

    const list = await rpc(tok.body.access_token, { method: 'tools/call', params: { name: 'get_month_overview', arguments: {} } });
    expect(JSON.parse(list.body.result.content[0].text)).toHaveProperty('income');
    // User left "rename" off → write tools refuse.
    const denied = await rpc(tok.body.access_token, { method: 'tools/call', params: { name: 'rename_merchant', arguments: { currentName: 'a', newName: 'b' } } });
    expect(denied.body.result.isError).toBe(true);

    // Refresh rotates both tokens.
    const ref = await request(app).post('/api/oauth/token').type('form')
      .send({ grant_type: 'refresh_token', refresh_token: tok.body.refresh_token, client_id: clientId });
    expect(ref.status).toBe(200);
    expect((await rpc(tok.body.access_token, { method: 'tools/list', params: {} })).status).toBe(401);
    expect((await rpc(ref.body.access_token, { method: 'tools/list', params: {} })).status).toBe(200);
    expect((await request(app).post('/api/oauth/token').type('form')
      .send({ grant_type: 'refresh_token', refresh_token: tok.body.refresh_token, client_id: clientId })).body.error).toBe('invalid_grant');

    // The grant shows in Settings and revoking it disconnects the assistant.
    const keys = await agent.get('/api/ai-keys');
    const grant = keys.body.find((k) => k.oauthClient === clientId);
    expect(grant).toMatchObject({ name: 'ChatGPT' });
    expect(JSON.stringify(keys.body)).not.toMatch(/refreshHash|tokenHash/);
    await agent.delete(`/api/ai-keys/${grant._id}`).set(CSRF);
    const gone = await rpc(ref.body.access_token, { method: 'tools/list', params: {} });
    expect(gone.status).toBe(401);
    expect(gone.headers['www-authenticate']).toMatch(/invalid_token/);
  });

  it('ביטול באישור מחזיר access_denied בלי קוד', async () => {
    const reg = await request(app).post('/api/oauth/register').send({ client_name: 'Claude', redirect_uris: ['https://claude.ai/api/mcp/auth_callback'] });
    const agent = request.agent(app);
    await registerApproved(agent, { email: 'oauth2@test.com' });
    const params = { response_type: 'code', client_id: reg.body.client_id, redirect_uri: 'https://claude.ai/api/mcp/auth_callback', code_challenge: 'x'.repeat(43), code_challenge_method: 'S256' };
    const res = await agent.post('/api/oauth/consent').set(CSRF).send({ params, approve: false });
    const back = new URL(res.body.redirectTo);
    expect(back.searchParams.get('error')).toBe('access_denied');
    expect(back.searchParams.get('code')).toBeNull();
    // A redirect URI the client didn't register never gets a code.
    const bad = await agent.post('/api/oauth/consent').set(CSRF).send({ params: { ...params, redirect_uri: 'https://chatgpt.com/other' }, approve: true });
    expect(bad.status).toBe(400);
  });
});
