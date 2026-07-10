import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { deriveSearchString } from '../controllers/categoryController.js';

const CSRF = { 'X-Fina-Client': 'web-app' };

async function registerAgent(email) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').send({ name: 'בודק', email, password: 'Str0ngPass!' });
  expect(res.status).toBe(201);
  return agent;
}

const addTx = (agent, description, category) =>
  agent.post('/api/transactions').set(CSRF).send({
    date: '2026-07-04', description, amount: 120, type: 'הוצאה', category,
  });

describe('למידת חוקי סיווג (rule learning) — שלב 3', () => {
  it('deriveSearchString גוזר שם סוחר יציב (מסיר אסמכתאות)', () => {
    expect(deriveSearchString('רמי לוי סניף 4471123')).toBe('רמי לוי סניף');
    expect(deriveSearchString('  PAYPAL *STEAM 123456 ')).toBe('PAYPAL STEAM');
  });

  it('suggest מציע טקסט-חיפוש וסופר עסקאות דומות', async () => {
    const agent = await registerAgent('rl-1@test.com');
    await addTx(agent, 'רמי לוי 111', 'כללי');
    await addTx(agent, 'רמי לוי 222', 'כללי');

    const res = await agent.post('/api/categories/rules/suggest').set(CSRF)
      .send({ description: 'רמי לוי 999', category: 'מזון' });
    expect(res.status).toBe(200);
    expect(res.body.searchString).toBe('רמי לוי');
    expect(res.body.matchCount).toBeGreaterThanOrEqual(2);
    expect(res.body.ruleExists).toBe(false);
    expect(res.body.suggestedCategory).toBe('מזון');
  });

  it('suggest לפי transactionId שואב את התיאור מהעסקה', async () => {
    const agent = await registerAgent('rl-2@test.com');
    const tx = await addTx(agent, 'שופרסל דיל 55123', 'כללי');
    const id = tx.body._id || tx.body.id || tx.body.data?._id;
    expect(id).toBeTruthy();

    const res = await agent.post('/api/categories/rules/suggest').set(CSRF).send({ transactionId: id });
    expect(res.status).toBe(200);
    expect(res.body.searchString).toContain('שופרסל');
  });

  it('יצירת חוק עם applyToExisting מסווגת עסקאות עבר', async () => {
    const agent = await registerAgent('rl-3@test.com');
    // קטגוריית יעד
    const cat = await agent.post('/api/categories').set(CSRF).send({ name: 'מזון', type: 'הוצאה' });
    const categoryId = cat.body._id || cat.body.id;
    expect(categoryId).toBeTruthy();

    await addTx(agent, 'רמי לוי 111', 'כללי');
    await addTx(agent, 'רמי לוי 222', 'כללי');

    const rule = await agent.post('/api/categories/rules').set(CSRF)
      .send({ searchString: 'רמי לוי', categoryId, matchType: 'contains', applyToExisting: true });
    expect(rule.status).toBe(201);
    expect(rule.body.appliedCount).toBeGreaterThanOrEqual(2);

    // העסקאות סווגו מחדש ל"מזון"
    const list = await agent.get('/api/transactions');
    const ramiTxns = list.body.filter((t) => (t.description || '').includes('רמי לוי'));
    expect(ramiTxns.length).toBeGreaterThanOrEqual(2);
    expect(ramiTxns.every((t) => t.category === 'מזון')).toBe(true);
  });
});
