// ============================================================
// CAMERA CONTROLLER — Camera CRUD + stream URL service
//
// Read endpoints: scoped to the requesting user's accessible locations.
// Write endpoints (create/update/delete): gated to SUPER_ADMIN at route level.
// ============================================================

const prisma = require('../config/prisma');
const {
  NotFoundError,
  ForbiddenError,
  ValidationError,
  asyncHandler,
} = require('../utils/errors');
const { logAudit } = require('../services/audit.service');
const { buildCameraScopeFilter, checkCameraAccess } = require('../middleware/rbac');

// Shared camera select — NEVER expose rtspUrl to clients
const cameraPublicSelect = {
  id: true,
  name: true,
  description: true,
  hlsUrl: true,
  status: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  office: {
    select: {
      id: true,
      name: true,
      district: {
        select: {
          id: true,
          name: true,
          code: true,
          state: { select: { id: true, name: true, code: true } },
        },
      },
    },
  },
};

// Admin select includes rtspUrl — only for SUPER_ADMIN
const cameraAdminSelect = { ...cameraPublicSelect, rtspUrl: true };

// ----------------------------------------------------------
// GET /api/cameras — list cameras filtered by user scope
// Query: ?officeId=&districtId=&stateId=&status=&page=&limit=
// ----------------------------------------------------------
const getCameras = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
  const { officeId, districtId, stateId, status } = req.query;

  const scopeFilter = buildCameraScopeFilter(req.scope);

  const where = {
    ...scopeFilter,
    isActive: true,
    ...(officeId && { officeId }),
    ...(districtId && { office: { districtId } }),
    ...(stateId && { office: { district: { stateId } } }),
    ...(status && { status }),
  };

  const isAdmin = req.user.role === 'SUPER_ADMIN';

  const [cameras, total] = await Promise.all([
    prisma.camera.findMany({
      where,
      select: isAdmin ? cameraAdminSelect : cameraPublicSelect,
      orderBy: [{ office: { name: 'asc' } }, { name: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.camera.count({ where }),
  ]);

  res.json({
    success: true,
    data: cameras,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  });
});

// ----------------------------------------------------------
// GET /api/cameras/:id — single camera
// ----------------------------------------------------------
const getCameraById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const hasAccess = await checkCameraAccess(req, id);
  if (!hasAccess) throw new NotFoundError('Camera not found');

  const isAdmin = req.user.role === 'SUPER_ADMIN';

  const camera = await prisma.camera.findUnique({
    where: { id },
    select: isAdmin ? cameraAdminSelect : cameraPublicSelect,
  });

  if (!camera || !camera.isActive) throw new NotFoundError('Camera not found');

  await logAudit({ userId: req.user.userId, action: 'VIEW_STREAM', cameraId: id, req });

  res.json({ success: true, data: camera });
});

// ----------------------------------------------------------
// GET /api/cameras/:id/stream — returns HLS URL for playback
// This is the endpoint the frontend video player calls
// ----------------------------------------------------------
const getCameraStream = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const hasAccess = await checkCameraAccess(req, id);
  if (!hasAccess) throw new ForbiddenError('You do not have access to this camera');

  const camera = await prisma.camera.findUnique({
    where: { id },
    select: { id: true, name: true, hlsUrl: true, status: true, isActive: true },
  });

  if (!camera || !camera.isActive) throw new NotFoundError('Camera not found');

  if (camera.status !== 'ACTIVE') {
    return res.json({
      success: false,
      data: { message: `Camera is currently ${camera.status.toLowerCase()}` },
    });
  }

  if (!camera.hlsUrl) {
    return res.json({
      success: false,
      data: { message: 'Stream not yet configured for this camera' },
    });
  }

  await logAudit({ userId: req.user.userId, action: 'VIEW_STREAM', cameraId: id, req });

  res.json({
    success: true,
    data: {
      cameraId: camera.id,
      name: camera.name,
      hlsUrl: camera.hlsUrl,
      status: camera.status,
    },
  });
});

// ----------------------------------------------------------
// POST /api/cameras — create camera (Super Admin only)
// ----------------------------------------------------------
const createCamera = asyncHandler(async (req, res) => {
  const { name, description, rtspUrl, hlsUrl, status, officeId } = req.body;

  const office = await prisma.office.findUnique({ where: { id: officeId } });
  if (!office) throw new ValidationError('officeId does not reference an existing office');

  const camera = await prisma.camera.create({
    data: { name, description, rtspUrl, hlsUrl, status: status || 'ACTIVE', officeId },
    select: cameraAdminSelect,
  });

  await logAudit({
    userId: req.user.userId,
    action: 'CREATE_CAMERA',
    cameraId: camera.id,
    metadata: { name: camera.name, officeId },
    req,
  });

  res.status(201).json({ success: true, data: camera });
});

// ----------------------------------------------------------
// PATCH /api/cameras/:id — update camera (Super Admin only)
// ----------------------------------------------------------
const updateCamera = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, rtspUrl, hlsUrl, status, officeId, isActive } = req.body;

  const existing = await prisma.camera.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Camera not found');

  if (officeId) {
    const office = await prisma.office.findUnique({ where: { id: officeId } });
    if (!office) throw new ValidationError('officeId does not reference an existing office');
  }

  const camera = await prisma.camera.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(rtspUrl !== undefined && { rtspUrl }),
      ...(hlsUrl !== undefined && { hlsUrl }),
      ...(status !== undefined && { status }),
      ...(officeId !== undefined && { officeId }),
      ...(isActive !== undefined && { isActive }),
    },
    select: cameraAdminSelect,
  });

  await logAudit({
    userId: req.user.userId,
    action: 'UPDATE_CAMERA',
    cameraId: id,
    metadata: { changes: req.body },
    req,
  });

  res.json({ success: true, data: camera });
});

// ----------------------------------------------------------
// DELETE /api/cameras/:id — soft delete (Super Admin only)
// ----------------------------------------------------------
const deleteCamera = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const existing = await prisma.camera.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Camera not found');

  await prisma.camera.update({ where: { id }, data: { isActive: false } });

  await logAudit({
    userId: req.user.userId,
    action: 'DELETE_CAMERA',
    cameraId: id,
    metadata: { name: existing.name },
    req,
  });

  res.json({ success: true, data: { message: 'Camera deactivated successfully' } });
});

module.exports = {
  getCameras,
  getCameraById,
  getCameraStream,
  createCamera,
  updateCamera,
  deleteCamera,
};
