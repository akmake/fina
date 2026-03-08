import authRoutes         from '../routes/auth.js';

/* חדש */
import projectRoutes      from '../routes/projectRoutes.js';
import electricalRoutes   from '../routes/electricalRoutes.js';

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
  /* ---------- מסלול מוגן חדש: פרויקטים כספיים ---------- */
  app.use('/api/projects', requireAuth, projectRoutes);

  /* ---------- שרטוט חשמל ---------- */
  app.use('/api/electrical', requireAuth, electricalRoutes);
};
