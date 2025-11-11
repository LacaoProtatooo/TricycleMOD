import jwt from 'jsonwebtoken';

export const generateTokenAndSetCookie = (res, user) => {
  // Use role to determine if user is admin (operator role is treated as admin)
  const isAdmin = user.role === 'operator';
  const token = jwt.sign({ id: user._id, isAdmin, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return token;
};
