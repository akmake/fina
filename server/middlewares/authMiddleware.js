import jwt from 'jsonwebtoken';

export const requireAuth = async (req, res, next) => {
  // The cookie name 'jwt' is correct.
  const token = req.cookies.jwt;

  if (!token) {
    return res.status(401).json({ message: 'לא מחובר' });
  }

  try {
    // ✅ התיקון: שימוש במפתח הסודי הנכון שמוגדר ב-tokenHandler.js
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    
    // We attach the user's ID and role to the request object
    req.user = { id: decoded.id, role: decoded.role };
    
    next();
  } catch (err) {
    // This will catch expired or invalid tokens
    return res.status(401).json({ message: 'טוקן לא חוקי / פג תוקף' });
  }
};

export const requireAdmin = (req, res, next) => {
  // This middleware should run *after* requireAuth
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'הרשאת מנהל נדרשת' });
  }
  next();
};
