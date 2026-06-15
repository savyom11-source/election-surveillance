// ============================================================
// VALIDATORS — Auth-related request schemas (Zod)
// ============================================================

const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

/**
 * validate — Express middleware factory.
 * Usage: router.post('/login', validate(loginSchema), handler)
 */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const { ValidationError } = require('../utils/errors');
      return next(new ValidationError('Validation failed', result.error.flatten().fieldErrors));
    }
    req.body = result.data;
    next();
  };
}

module.exports = {
  loginSchema,
  refreshSchema,
  changePasswordSchema,
  validate,
};
