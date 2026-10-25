import User from '../models/User.js';

/**
 * Sign-up is an access request (no session until an admin approves). Tests that
 * need a logged-in user register, approve directly in the DB, then log in on the
 * same agent. Returns the login response (200, body.user, session cookies set).
 */
export const registerApproved = async (agent, { name = 'בודק', email, password = 'Str0ngPass!' }) => {
  const reg = await agent.post('/api/auth/register').send({ name, email, password });
  if (reg.status !== 202) throw new Error(`register failed: ${reg.status} ${JSON.stringify(reg.body)}`);
  await User.updateOne({ email }, { $set: { approvalStatus: 'approved' } });
  return agent.post('/api/auth/login').send({ email, password });
};
