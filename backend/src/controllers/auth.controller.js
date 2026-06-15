// ============================================================
// AUTH CONTROLLER — Login, refresh, logout, current user
// ============================================================

const bcrypt = require('bcrypt');
const prisma = require('../config/prisma');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  expiryToDate,
} = require('../utils/jwt');
const env = require('../config/env');
const { UnauthorizedError, NotFoundError } = require('../utils/errors');
const { asyncHandler } = require('../utils/errors');
const { logAudit } = require('../services/audit.service');

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns: { accessToken, refreshToken, user }
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.isActive) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Store refresh token so it can be revoked later
  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: expiryToDate(env.jwt.refreshExpiry),
    },
  });

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await logAudit({ userId: user.id, action: 'LOGIN', req });

  res.json({
    success: true,
    data: {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    },
  });
});

/**
 * POST /api/auth/refresh
 * Body: { refreshToken }
 * Returns: { accessToken, refreshToken } — rotates refresh token
 */
const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  // Verify signature + expiry
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  // Check token exists in DB and isn't revoked
  const stored = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
  });

  if (!stored || stored.isRevoked || stored.expiresAt < new Date()) {
    throw new UnauthorizedError('Refresh token revoked or expired');
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  if (!user || !user.isActive) {
    throw new UnauthorizedError('User not found or inactive');
  }

  // Rotate: revoke old, issue new
  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: stored.id },
      data: { isRevoked: true },
    }),
    prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: user.id,
        expiresAt: expiryToDate(env.jwt.refreshExpiry),
      },
    }),
  ]);

  res.json({
    success: true,
    data: {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    },
  });
});

/**
 * POST /api/auth/logout
 * Body: { refreshToken }
 * Revokes the refresh token
 */
const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  await prisma.refreshToken.updateMany({
    where: { token: refreshToken },
    data: { isRevoked: true },
  });

  if (req.user) {
    await logAudit({ userId: req.user.userId, action: 'LOGOUT', req });
  }

  res.json({ success: true, data: { message: 'Logged out successfully' } });
});

/**
 * GET /api/auth/me
 * Requires: authenticate middleware
 * Returns current user's profile + scope summary
 */
const me = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      userScopes: {
        select: {
          state: { select: { id: true, name: true, code: true } },
          district: { select: { id: true, name: true, code: true } },
          office: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!user) throw new NotFoundError('User not found');

  res.json({ success: true, data: user });
});

/**
 * POST /api/auth/change-password
 * Body: { oldPassword, newPassword }
 */
const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await prisma.user.findUnique({ where: { id: req.user.userId } });

  const matches = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!matches) throw new UnauthorizedError('Current password is incorrect');

  const newHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  });

  // Revoke all existing refresh tokens — force re-login everywhere
  await prisma.refreshToken.updateMany({
    where: { userId: user.id },
    data: { isRevoked: true },
  });

  res.json({ success: true, data: { message: 'Password changed. Please log in again.' } });
});

module.exports = { login, refresh, logout, me, changePassword };
