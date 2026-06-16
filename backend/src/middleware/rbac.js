// ============================================================
// RBAC MIDDLEWARE — Role checks + location scope filtering
// ============================================================

const prisma = require('../config/prisma');
const { ForbiddenError } = require('../utils/errors');

/**
 * requireRole — restricts route to specific role(s)
 * Usage: requireRole('SUPER_ADMIN')
 *        requireRole('SUPER_ADMIN', 'STATE_ADMIN')
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError(
        `This action requires one of these roles: ${allowedRoles.join(', ')}`
      ));
    }
    next();
  };
}

/**
 * loadUserScope — fetches the user's location scopes from DB
 * and attaches req.scope = { isSuperAdmin, stateIds, districtIds, officeIds }
 *
 * SUPER_ADMIN bypasses all scope checks (isSuperAdmin = true, empty arrays)
 * Other roles get arrays of location IDs they're allowed to access
 */
async function loadUserScope(req, res, next) {
  try {
    if (req.user.role === 'SUPER_ADMIN') {
      req.scope = {
        isSuperAdmin: true,
        stateIds: [],
        districtIds: [],
        officeIds: [],
      };
      return next();
    }

    const scopes = await prisma.userScope.findMany({
      where: { userId: req.user.userId },
      select: { stateId: true, districtId: true, officeId: true },
    });

    req.scope = {
      isSuperAdmin: false,
      stateIds: scopes.filter(s => s.stateId).map(s => s.stateId),
      districtIds: scopes.filter(s => s.districtId).map(s => s.districtId),
      officeIds: scopes.filter(s => s.officeId).map(s => s.officeId),
    };

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * buildCameraScopeFilter — returns a Prisma `where` clause fragment
 * that restricts Camera queries to the user's accessible scope.
 *
 * A camera is accessible if:
 *  - user is SUPER_ADMIN (no filter), OR
 *  - camera.office.id is in officeIds, OR
 *  - camera.office.district.id is in districtIds, OR
 *  - camera.office.district.state.id is in stateIds
 */
function buildCameraScopeFilter(scope) {
  if (scope.isSuperAdmin) return {};

  return {
    OR: [
      { officeId: { in: scope.officeIds } },
      { office: { districtId: { in: scope.districtIds } } },
      { office: { district: { stateId: { in: scope.stateIds } } } },
    ],
  };
}

/**
 * buildStateScopeFilter — Prisma `where` fragment restricting State queries
 * to the user's accessible scope.
 *
 * A state is accessible if:
 *  - user is SUPER_ADMIN (no filter), OR
 *  - state.id is in stateIds, OR
 *  - any of its districts is in districtIds, OR
 *  - any of its districts has an office in officeIds
 */
function buildStateScopeFilter(scope) {
  if (scope.isSuperAdmin) return {};

  return {
    OR: [
      { id: { in: scope.stateIds } },
      { districts: { some: { id: { in: scope.districtIds } } } },
      { districts: { some: { offices: { some: { id: { in: scope.officeIds } } } } } },
    ],
  };
}

/**
 * buildDistrictScopeFilter — Prisma `where` fragment restricting District
 * queries to the user's accessible scope.
 *
 * A district is accessible if:
 *  - user is SUPER_ADMIN (no filter), OR
 *  - district.id is in districtIds, OR
 *  - district.stateId is in stateIds, OR
 *  - any of its offices is in officeIds
 */
function buildDistrictScopeFilter(scope) {
  if (scope.isSuperAdmin) return {};

  return {
    OR: [
      { id: { in: scope.districtIds } },
      { stateId: { in: scope.stateIds } },
      { offices: { some: { id: { in: scope.officeIds } } } },
    ],
  };
}

/**
 * buildOfficeScopeFilter — restricts Office queries to user's scope
 */
function buildOfficeScopeFilter(scope) {
  if (scope.isSuperAdmin) return {};

  return {
    OR: [
      { id: { in: scope.officeIds } },
      { districtId: { in: scope.districtIds } },
      { district: { stateId: { in: scope.stateIds } } },
    ],
  };
}

/**
 * checkCameraAccess — verifies a specific camera ID is within user's scope
 * Throws ForbiddenError if not. Use for single-resource endpoints
 * (e.g. GET /cameras/:id/stream, GET /cameras/:id/recordings)
 */
async function checkCameraAccess(req, cameraId) {
  if (req.scope.isSuperAdmin) return true;

  const camera = await prisma.camera.findUnique({
    where: { id: cameraId },
    select: {
      officeId: true,
      office: { select: { districtId: true, district: { select: { stateId: true } } } },
    },
  });

  if (!camera) return false;

  const { officeId, office } = camera;
  const districtId = office.districtId;
  const stateId = office.district.stateId;

  const hasAccess =
    req.scope.officeIds.includes(officeId) ||
    req.scope.districtIds.includes(districtId) ||
    req.scope.stateIds.includes(stateId);

  return hasAccess;
}

module.exports = {
  requireRole,
  loadUserScope,
  buildStateScopeFilter,
  buildDistrictScopeFilter,
  buildOfficeScopeFilter,
  buildCameraScopeFilter,
  checkCameraAccess,
};
