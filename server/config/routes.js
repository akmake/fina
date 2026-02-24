import authRoutes         from '../routes/auth.js';
import tzitzitRoutes      from '../routes/tzitzitRoutes.js';

/* חדש */
import projectRoutes      from '../routes/projectRoutes.js';

import { requireAuth }    from '../middlewares/authMiddleware.js';
import { csrfTokenHandler, csrfProtection } from '../middlewares/csrf.js';

export const configureRoutes = (app) => {
  /* ---------- מסלולים ציבוריים ---------- */
  app.use('/api/auth', authRoutes);

  /* ---------- הגנת CSRF ---------- */
  // נקודת קבלת טוקן
  app.get('/api/csrf-token', csrfTokenHandler);

  // להחיל CSRF על כל מה שמתחת
  app.use(csrfProtection);

  /* ---------- מסלולים מוגנים ---------- */
  app.use('/api/tzitzit',  requireAuth, tzitzitRoutes);

  /* ---------- מסלול מוגן חדש: פרויקטים כספיים ---------- */
  app.use('/api/projects', requireAuth, projectRoutes);
};
