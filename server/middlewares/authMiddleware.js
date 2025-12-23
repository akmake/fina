import jwt from 'jsonwebtoken';

export const requireAuth = async (req, res, next) => {
  const token = req.cookies.jwt;

  if (!token) {
    return res.status(401).json({ message: 'לא מחובר' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    
    // התיקון הקריטי: אנחנו שמים גם 'id' וגם '_id' כדי למנוע התנגשויות
    req.user = { 
        id: decoded.id, 
        _id: decoded.id, // זה השדה שהקונטרולרים מחפשים!
        role: decoded.role 
    };
    
    next();
  } catch (err) {
    return res.status(401).json({ message: 'טוקן לא חוקי / פג תוקף' });
  }
};

export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'הרשאת מנהל נדרשת' });
  }
  next();
};