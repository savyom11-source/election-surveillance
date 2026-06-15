// ============================================================
// AUTH MIDDLEWARE — Verifies JWT access token
// Attaches req.user = { userId, role, email }
// ============================================================

const { verifyAccessToken } = require('../utils/jwt');
const { UnauthorizedError } = require('../utils/errors');

function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or malformed Authorization header');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    req.user = {
      userId: decoded.userId,
      role: decoded.role,
      email: decoded.email,
    };

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authenticate };
