// ============================================================
// VALIDATE MIDDLEWARE — Shared Zod request validator
// Usage: router.post('/x', validate(someSchema), handler)
// ============================================================

const { ValidationError } = require('../utils/errors');

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(new ValidationError('Validation failed', result.error.flatten().fieldErrors));
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validate };
