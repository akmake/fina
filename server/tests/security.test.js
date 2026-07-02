import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';

const CSRF = { 'X-Fina-Client': 'web-app' };

describe('CSRF', () => {
  it('בקשת POST מוגנת בלי X-Fina-Client נחסמת ב-403', async () => {
    const res = await request(app).post('/api/transactions').send({});
    expect(res.status).toBe(403);
  });
});

describe('נתיבי סריקה דורשים אימות', () => {
  it('POST /api/scrape בלי עוגיית jwt מחזיר 401', async () => {
    const res = await request(app)
      .post('/api/scrape')
      .set(CSRF)
      .send({ bank: 'hapoalim', credentials: {} });
    expect(res.status).toBe(401);
  });

  it('POST /api/cal/request-otp בלי עוגיית jwt מחזיר 401', async () => {
    const res = await request(app)
      .post('/api/cal/request-otp')
      .set(CSRF)
      .send({});
    expect(res.status).toBe(401);
  });

  it('POST /api/import בלי עוגיית jwt מחזיר 401', async () => {
    const res = await request(app)
      .post('/api/import')
      .set(CSRF)
      .send({});
    expect(res.status).toBe(401);
  });
});

describe('נתיבי אדמין', () => {
  it('משתמש רגיל לא יכול לגשת ל-GET /api/admin/users', async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/auth/register')
      .send({ name: 'רגיל', email: 'plain@test.com', password: 'Str0ngPass!' });

    const res = await agent.get('/api/admin/users');
    expect(res.status).toBe(403);
  });
});
