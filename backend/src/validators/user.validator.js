// ============================================================
// VALIDATORS — User management request schemas (Zod)
// ============================================================

const { z } = require('zod');
const { ValidationError } = require('../utils/errors');

const ROLES = ['SUPER_ADMIN', 'STATE_ADMIN', 'DISTRICT_OBSERVER', 'OFFICE_OBSERVER'];

const uuid = z.string().uuid('Invalid ID format');

const scopeSchema = z
  .object({
    stateIds: z.array(uuid).default([]),
    districtIds: z.array(uuid).default([]),
    officeIds: z.array(uuid).default([]),
  })
  .default({ stateIds: [], districtIds: [], officeIds: [] });

/**
 * Cross-field check: non-super-admin roles must have at least one
 * matching scope entry for the location level their role implies.
 */
function checkScopeForRole(data, ctx) {
  const { role, scope } = data;

  if (role === 'STATE_ADMIN' && scope.stateIds.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'STATE_ADMIN requires at least one stateId in scope',
      path: ['scope', 'stateIds'],
    });
  }
  if (role === 'DISTRICT_OBSERVER' && scope.districtIds.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'DISTRICT_OBSERVER requires at least one districtId in scope',
      path: ['scope', 'districtIds'],
    });
  }
  if (role === 'OFFICE_OBSERVER' && scope.officeIds.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'OFFICE_OBSERVER requires at least one officeId in scope',
      path: ['scope', 'officeIds'],
    });
  }
}

const createUserSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    role: z.enum(ROLES, { errorMap: () => ({ message: `Role must be one of: ${ROLES.join(', ')}` }) }),
    scope: scopeSchema,
  })
  .superRefine(checkScopeForRole);

const updateUserSchema = z
  .object({
    name: z.string().min(2).optional(),
    email: z.string().email().optional(),
    role: z.enum(ROLES).optional(),
    scope: scopeSchema.optional(),
  })
  .superRefine((data, ctx) => {
    // Only validate scope-vs-role if both are present in this update
    if (data.role && data.scope) {
      checkScopeForRole(data, ctx);
    }
  });

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

/**
 * validate — Express middleware factory (shared pattern with auth.validator)
 */
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

module.exports = {
  ROLES,
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
  validate,
};
