// ============================================================
// JWT UTILITIES — Token generation and verification
// ============================================================

const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Generate a short-lived access token
 * Payload includes: userId, role
 */
function generateAccessToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      role: user.role,
      email: user.email,
    },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpiry }
  );
}

/**
 * Generate a long-lived refresh token
 * Payload includes only userId — kept minimal
 */
function generateRefreshToken(user) {
  return jwt.sign(
    { userId: user.id },
    env.jwt.refreshSecret,
    { expiresIn: env.jwt.refreshExpiry }
  );
}

/**
 * Verify access token — throws if invalid/expired
 */
function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

/**
 * Verify refresh token — throws if invalid/expired
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}

/**
 * Convert JWT expiry string (e.g. "7d") to a Date object
 * Used for storing refresh token expiry in DB
 */
function expiryToDate(expiryStr) {
  const match = expiryStr.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid expiry format: ${expiryStr}`);

  const value = parseInt(match[1]);
  const unit = match[2];
  const msPerUnit = { s: 1000, m: 60000, h: 3600000, d: 86400000 };

  return new Date(Date.now() + value * msPerUnit[unit]);
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  expiryToDate,
};
