import bcrypt from 'bcrypt';
import User from '../models/User.js';
import { exportAccountData, anonymizeAndDelete } from '../services/accountService.js';
import { planFor, planDefinition } from '../services/subscriptionService.js';
import { audit } from '../utils/audit.js';

/**
 * accountController — self-service account management (Phase 4 SaaS shell):
 * profile+plan snapshot, data export (portability), account deletion (right to
 * be forgotten), and onboarding completion.
 * Mounted with requireAuth + familyScope, so req.householdId is available.
 */

const clearAuthCookies = (res) => {
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  };
  res.clearCookie('jwt', opts);
  res.clearCookie('refreshToken', opts);
};

// GET /api/account — profile + verification + 2FA + current plan
export const getAccount = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).lean();
    if (!user) return res.status(404).json({ message: 'משתמש לא נמצא' });

    const planId = await planFor(req.householdId);
    return res.json({
      account: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: !!user.emailVerified,
        twoFactorEnabled: !!user.twoFactorEnabled,
        onboardedAt: user.onboardedAt || null,
        createdAt: user.createdAt,
      },
      plan: { id: planId, ...planDefinition(planId) },
    });
  } catch (error) {
    console.error('getAccount error:', error);
    return res.status(500).json({ message: 'שגיאה בטעינת פרטי החשבון' });
  }
};

// GET /api/account/export — full JSON dump of the caller's data (GDPR portability)
export const exportData = async (req, res) => {
  try {
    const payload = await exportAccountData(req.user._id);
    await audit(req, 'account.export', 'User', { entityId: req.user._id });
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="fina-export-${Date.now()}.json"`);
    return res.status(200).send(JSON.stringify(payload, null, 2));
  } catch (error) {
    console.error('exportData error:', error);
    return res.status(500).json({ message: 'שגיאה בייצוא הנתונים' });
  }
};

// DELETE /api/account { password? } — anonymize + soft-delete, then log out
export const deleteAccount = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'משתמש לא נמצא' });

    // Password users must confirm with their password; OAuth-only users confirm
    // via an explicit { confirm:true } (they have no local password).
    if (user.passwordHash) {
      const { password } = req.body || {};
      if (!password || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ message: 'סיסמה שגויה — נדרש אישור למחיקת החשבון' });
      }
    } else if (!req.body?.confirm) {
      return res.status(400).json({ message: 'נדרש אישור למחיקת החשבון' });
    }

    await anonymizeAndDelete(req.user._id);
    await audit(req, 'account.delete', 'User', { entityId: req.user._id });

    clearAuthCookies(res);
    return res.json({ message: 'החשבון נמחק. אנו מצטערים לראותך עוזב/ת.' });
  } catch (error) {
    console.error('deleteAccount error:', error);
    return res.status(500).json({ message: 'שגיאה במחיקת החשבון' });
  }
};

// POST /api/account/onboarding — mark the first-run flow complete
export const completeOnboarding = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { onboardedAt: new Date() } },
      { new: true }
    ).select('onboardedAt');
    if (!user) return res.status(404).json({ message: 'משתמש לא נמצא' });
    return res.json({ onboardedAt: user.onboardedAt });
  } catch (error) {
    console.error('completeOnboarding error:', error);
    return res.status(500).json({ message: 'שגיאה בשמירת מצב ההצטרפות' });
  }
};
