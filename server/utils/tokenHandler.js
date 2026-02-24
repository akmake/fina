import jwt from 'jsonwebtoken';

const signAccessToken = (payload) =>
  jwt.sign(payload, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });

const signRefreshToken = (payload) =>
  jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

export const createAndSendTokens = (user, res) => {
  const accessToken = signAccessToken({ id: user._id, role: user.role });
  const refreshToken = signRefreshToken({ id: user._id, v: user.tokenVersion });

  const secure = process.env.NODE_ENV === 'production';
  const sameSite = process.env.NODE_ENV === 'production' ? 'none' : 'lax';

  // partitioned נדרש עבור Safari/iOS (CHIPS) כשעובדים cross-site
  const partitioned = secure; // רק בפרודקשן

  res
    .cookie('jwt', accessToken, {
      httpOnly: true,
      sameSite,
      secure,
      path: '/',
      partitioned,
      maxAge: 15 * 60 * 1000,
    })
    .cookie('refreshToken', refreshToken, {
      httpOnly: true,
      sameSite,
      secure,
      path: '/',
      partitioned,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
};