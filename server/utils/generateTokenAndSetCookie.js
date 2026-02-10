import jwt from 'jsonwebtoken';

// Generates access token + refresh token, sets cookies, and stores refresh token on user
export const generateTokenAndSetCookie = async (res, user) => {
  const isAdmin = user.role === 'operator';

  const accessExpiresIn = process.env.JWT_ACCESS_EXPIRES || '15m';
  const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES || '30d';

  const accessToken = jwt.sign({ id: user._id, isAdmin, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: accessExpiresIn,
  });

  const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  const refreshToken = jwt.sign({ id: user._id }, refreshSecret, {
    expiresIn: refreshExpiresIn,
  });

  // Set access token cookie (short-lived)
  res.cookie('token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: msToMs(accessExpiresIn),
  });

  // Set refresh token cookie (long-lived)
  const refreshMaxAge = msToMs(refreshExpiresIn);
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: refreshMaxAge,
  });

  // Persist refresh token in user record for revocation/rotation support
  try {
    const expiresAt = new Date(Date.now() + refreshMaxAge);
    user.refreshTokens = user.refreshTokens || [];
    user.refreshTokens.push({ token: refreshToken, createdAt: new Date(), expiresAt });
    await user.save();
  } catch (e) {
    // non-fatal: log and continue
    console.error('Failed to persist refresh token on user:', e);
  }

  return accessToken;
};

// Helper: convert a JWT-style expiresIn string to milliseconds for cookie maxAge
function msToMs(expiresIn) {
  // accepts formats like '15m', '30d', '7d', or numeric seconds
  if (!expiresIn) return 0;
  if (typeof expiresIn === 'number') return expiresIn * 1000;
  const match = /^([0-9]+)(s|m|h|d)$/.exec(String(expiresIn));
  if (!match) return 0;
  const n = Number(match[1]);
  const unit = match[2];
  switch (unit) {
    case 's': return n * 1000;
    case 'm': return n * 60 * 1000;
    case 'h': return n * 60 * 60 * 1000;
    case 'd': return n * 24 * 60 * 60 * 1000;
    default: return 0;
  }
}
