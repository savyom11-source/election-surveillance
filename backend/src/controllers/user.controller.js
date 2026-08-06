// ============================================================
// USER CONTROLLER — User & role/scope management (Super Admin only)
// ============================================================

const bcrypt = require('bcrypt');
const prisma = require('../config/prisma');
const {
  NotFoundError,
  ConflictError,
  ValidationError,
  asyncHandler,
} = require('../utils/errors');
const { logAudit } = require('../services/audit.service');
const { ForbiddenError } = require('../utils/errors');

// ----------------------------------------------------------
// Shared select shape — never expose passwordHash
// ----------------------------------------------------------
const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true, email: true } },
  userScopes: {
    select: {
      id: true,
      state: { select: { id: true, name: true, code: true } },
      district: {
        select: {
          id: true,
          name: true,
          code: true,
          state: { select: { id: true, name: true, code: true } },
        },
      },
      office: {
        select: {
          id: true,
          name: true,
          district: {
            select: {
              id: true,
              name: true,
              state: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  },
};

// ----------------------------------------------------------
// Helpers
// ----------------------------------------------------------

/**
 * Ensure every ID referenced in scope actually exists.
 * Prevents creating dangling UserScope rows from typo'd IDs.
 */
async function validateScopeIdsExist(scope) {
  const { stateIds = [], districtIds = [], officeIds = [] } = scope;

  if (stateIds.length) {
    const count = await prisma.state.count({ where: { id: { in: stateIds } } });
    if (count !== stateIds.length) {
      throw new ValidationError('One or more stateIds in scope do not exist');
    }
  }
  if (districtIds.length) {
    const count = await prisma.district.count({ where: { id: { in: districtIds } } });
    if (count !== districtIds.length) {
      throw new ValidationError('One or more districtIds in scope do not exist');
    }
  }
  if (officeIds.length) {
    const count = await prisma.office.count({ where: { id: { in: officeIds } } });
    if (count !== officeIds.length) {
      throw new ValidationError('One or more officeIds in scope do not exist');
    }
  }
}

/**
 * Flatten { stateIds, districtIds, officeIds } into UserScope.createMany rows
 */
function scopeToCreateData(scope, userId, role) {
  const rows = [];
  if (role === 'STATE_ADMIN') {
    for (const stateId of scope.stateIds || []) rows.push({ userId, stateId });
  } else if (role === 'DISTRICT_OBSERVER') {
    for (const districtId of scope.districtIds || []) rows.push({ userId, districtId });
  } else if (role === 'OFFICE_OBSERVER') {
    for (const officeId of scope.officeIds || []) rows.push({ userId, officeId });
  }
  return rows;
}

async function validateScopeSubservience(req, targetRole, targetScope) {
  if (req.scope.isSuperAdmin) return;
  if (targetRole === 'SUPER_ADMIN' || targetRole === 'STATE_ADMIN') {
    throw new ForbiddenError('You cannot create or assign Super Admin or State Admin roles');
  }

  const { stateIds = [], districtIds = [], officeIds = [] } = targetScope || {};

  for (const sid of stateIds) {
    if (!req.scope.stateIds.includes(sid)) {
      throw new ForbiddenError(`You do not have access to assign state ID ${sid}`);
    }
  }

  if (districtIds.length) {
    const districts = await prisma.district.findMany({ where: { id: { in: districtIds } } });
    for (const d of districts) {
      if (!req.scope.stateIds.includes(d.stateId)) {
         throw new ForbiddenError(`You do not have access to assign district ID ${d.id}`);
      }
    }
  }

  if (officeIds.length) {
    const offices = await prisma.office.findMany({ where: { id: { in: officeIds } }, include: { district: true } });
    for (const o of offices) {
      if (!req.scope.stateIds.includes(o.district.stateId)) {
         throw new ForbiddenError(`You do not have access to assign office ID ${o.id}`);
      }
    }
  }
}

async function checkUserAccess(req, targetUserId) {
  if (req.scope.isSuperAdmin) return true;
  
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) return false;
  if (target.role === 'SUPER_ADMIN') return false; // Cannot touch Super Admins

  const scopes = await prisma.userScope.findMany({
    where: { userId: targetUserId },
    include: {
      district: true,
      office: { include: { district: true } }
    }
  });

  if (scopes.length === 0) return false;

  for (const s of scopes) {
    if (s.stateId && !req.scope.stateIds.includes(s.stateId)) return false;
    if (s.districtId && !req.scope.stateIds.includes(s.district.stateId)) return false;
    if (s.officeId && !req.scope.stateIds.includes(s.office.district.stateId)) return false;
  }
  return true;
}

// ----------------------------------------------------------
// POST /api/users — create user (Super Admin only)
// ----------------------------------------------------------
const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, scope } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ConflictError('A user with this email already exists');

  if (role !== 'SUPER_ADMIN') {
    await validateScopeIdsExist(scope);
    await validateScopeSubservience(req, role, scope);
  } else if (!req.scope.isSuperAdmin) {
    throw new ForbiddenError('You cannot create Super Admins or State Admins');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
        createdById: req.user.userId,
      },
    });

    if (role !== 'SUPER_ADMIN') {
      const scopeRows = scopeToCreateData(scope, user.id, role);
      if (scopeRows.length) {
        await tx.userScope.createMany({ data: scopeRows });
      }
    }

    return user;
  });

  await logAudit({
    userId: req.user.userId,
    action: 'CREATE_USER',
    metadata: { targetUserId: created.id, email: created.email, role: created.role },
    req,
  });

  const full = await prisma.user.findUnique({ where: { id: created.id }, select: userSelect });

  res.status(201).json({ success: true, data: full });
});

// ----------------------------------------------------------
// GET /api/users — list users (paginated, filterable)
// Query: ?page=1&limit=20&role=STATE_ADMIN&isActive=true&search=kota
// ----------------------------------------------------------
const getUsers = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
  const { role, isActive, search } = req.query;

  const where = {};

  if (role) {
    if (!['SUPER_ADMIN', 'STATE_ADMIN', 'DISTRICT_OBSERVER', 'OFFICE_OBSERVER'].includes(role)) {
      throw new ValidationError(`Invalid role filter: ${role}`);
    }
    where.role = role;
  }

  if (isActive !== undefined) {
    where.isActive = isActive === 'true';
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (!req.scope.isSuperAdmin) {
    // Only see users in the same state
    where.userScopes = {
      some: {
        OR: [
          { stateId: { in: req.scope.stateIds } },
          { district: { stateId: { in: req.scope.stateIds } } },
          { office: { district: { stateId: { in: req.scope.stateIds } } } }
        ]
      }
    };
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  res.json({
    success: true,
    data: users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
});

// ----------------------------------------------------------
// GET /api/users/:id — single user with full scope detail
// ----------------------------------------------------------
const getUserById = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: userSelect,
  });

  if (!user) throw new NotFoundError('User not found');
  if (!(await checkUserAccess(req, req.params.id))) throw new ForbiddenError('Access denied');

  res.json({ success: true, data: user });
});

// ----------------------------------------------------------
// PATCH /api/users/:id — update name/email/role/scope
// (isActive is handled by dedicated activate/deactivate endpoints)
// ----------------------------------------------------------
const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, email, role, scope } = req.body;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new NotFoundError('User not found');
  if (!(await checkUserAccess(req, id))) throw new ForbiddenError('Access denied');

  // Safety: prevent the acting Super Admin from demoting themselves
  if (id === req.user.userId && role && role !== 'SUPER_ADMIN') {
    throw new ValidationError('You cannot change your own role away from SUPER_ADMIN');
  }

  if (email && email !== target.email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictError('A user with this email already exists');
  }

  const effectiveRole = role || target.role;

  if (scope && effectiveRole !== 'SUPER_ADMIN') {
    await validateScopeIdsExist(scope);
    await validateScopeSubservience(req, effectiveRole, scope);
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(role && { role }),
      },
    });

    if (scope) {
      // Full replace of scope set
      await tx.userScope.deleteMany({ where: { userId: id } });
      if (effectiveRole !== 'SUPER_ADMIN') {
        const scopeRows = scopeToCreateData(scope, id, effectiveRole);
        if (scopeRows.length) await tx.userScope.createMany({ data: scopeRows });
      }
    } else if (role === 'SUPER_ADMIN' && target.role !== 'SUPER_ADMIN') {
      // Promoted to Super Admin — scope no longer meaningful, clear it
      await tx.userScope.deleteMany({ where: { userId: id } });
    }
  });

  await logAudit({
    userId: req.user.userId,
    action: role ? 'ASSIGN_ROLE' : 'UPDATE_USER',
    metadata: { targetUserId: id, changes: req.body },
    req,
  });

  const full = await prisma.user.findUnique({ where: { id }, select: userSelect });

  res.json({ success: true, data: full });
});

// ----------------------------------------------------------
// PATCH /api/users/:id/deactivate
// ----------------------------------------------------------
const deactivateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (id === req.user.userId) {
    throw new ValidationError('You cannot deactivate your own account');
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new NotFoundError('User not found');
  if (!(await checkUserAccess(req, id))) throw new ForbiddenError('Access denied');

  if (!target.isActive) {
    return res.json({ success: true, data: { message: 'User is already inactive' } });
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { isActive: false } }),
    prisma.refreshToken.updateMany({ where: { userId: id }, data: { isRevoked: true } }),
  ]);

  await logAudit({
    userId: req.user.userId,
    action: 'DELETE_USER', // soft-delete / deactivation
    metadata: { targetUserId: id },
    req,
  });

  res.json({ success: true, data: { message: 'User deactivated successfully' } });
});

// ----------------------------------------------------------
// PATCH /api/users/:id/activate
// ----------------------------------------------------------
const activateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new NotFoundError('User not found');
  if (!(await checkUserAccess(req, id))) throw new ForbiddenError('Access denied');

  if (target.isActive) {
    return res.json({ success: true, data: { message: 'User is already active' } });
  }

  await prisma.user.update({ where: { id }, data: { isActive: true } });

  await logAudit({
    userId: req.user.userId,
    action: 'UPDATE_USER',
    metadata: { targetUserId: id, action: 'reactivated' },
    req,
  });

  res.json({ success: true, data: { message: 'User activated successfully' } });
});

// ----------------------------------------------------------
// PATCH /api/users/:id/reset-password — admin sets new password
// ----------------------------------------------------------
const resetPassword = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new NotFoundError('User not found');
  if (!(await checkUserAccess(req, id))) throw new ForbiddenError('Access denied');

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({ where: { userId: id }, data: { isRevoked: true } }),
  ]);

  await logAudit({
    userId: req.user.userId,
    action: 'UPDATE_USER',
    metadata: { targetUserId: id, action: 'password_reset' },
    req,
  });

  res.json({
    success: true,
    data: { message: 'Password reset successfully. User must log in again.' },
  });
});

// ----------------------------------------------------------
// DELETE /api/users/:id — hard delete
// ----------------------------------------------------------
const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (id === req.user.userId) {
    throw new ValidationError('You cannot delete your own account');
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('User not found');
  if (!(await checkUserAccess(req, id))) throw new ForbiddenError('Access denied');

  await prisma.$transaction([
    // Unlink any users created by this user
    prisma.user.updateMany({ where: { createdById: id }, data: { createdById: null } }),
    // Delete their audit logs
    prisma.auditLog.deleteMany({ where: { userId: id } }),
    // Delete the user
    prisma.user.delete({ where: { id } }),
  ]);

  await logAudit({
    userId: req.user.userId,
    action: 'DELETE_USER',
    metadata: { targetUserId: id, action: 'hard_delete', name: existing.name },
    req,
  });

  res.json({ success: true, data: { message: 'User permanently deleted' } });
});

module.exports = {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deactivateUser,
  activateUser,
  resetPassword,
  deleteUser,
};
