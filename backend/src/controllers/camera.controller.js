// ============================================================
// CAMERA CONTROLLER
//
// KEY DESIGN:
//   - streamUrl stored in DB (rtmp:// or rtsp://)
//   - hlsUrl NEVER stored — generated dynamically via hlsGenerator
//   - streamUrl NEVER sent to browser — internal only
//
// HLS generation examples:
//   rtmp://vendor.com:1935/live/RDNL3117
//     → http://MEDIAMTX:8888/live/RDNL3117/index.m3u8
//   rtsp://192.168.1.100:554/stream1
//     → http://MEDIAMTX:8888/stream1/index.m3u8
// ============================================================

const prisma = require('../config/prisma');
const env    = require('../config/env');
const { generateHlsUrl, validateStreamUrl, detectStreamType } = require('../utils/hlsGenerator');
const { NotFoundError, ValidationError, ForbiddenError, asyncHandler } = require('../utils/errors');
const { logAudit } = require('../services/audit.service');
const { buildCameraScopeFilter, checkCameraAccess } = require('../middleware/rbac');

// Format camera for API response
// - Strip streamUrl (internal only)
// - Add generated hlsUrl
function formatCamera(camera) {
  const { streamUrl, ...rest } = camera;
  return {
    ...rest,
    hlsUrl:     generateHlsUrl(streamUrl),
    // Include streamType so frontend knows what kind of stream it is
  };
}

// Shared Prisma select — always include streamUrl internally
const cameraSelect = {
  id: true, name: true, description: true,
  streamUrl: true, streamType: true,
  status: true, isActive: true,
  createdAt: true, updatedAt: true, officeId: true,
  office: {
    select: {
      id: true, name: true,
      district: {
        select: {
          id: true, name: true, code: true,
          state: { select: { id: true, name: true, code: true } },
        },
      },
    },
  },
};

// ============================================================
// GET /api/cameras — list cameras scoped to user
// ============================================================
const getCameras = asyncHandler(async (req, res) => {
  const page   = Math.max(parseInt(req.query.page)  || 1, 1);
  const limit  = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
  const { status, officeId, districtId, stateId } = req.query;

  const where = {
    ...buildCameraScopeFilter(req.scope),
    isActive: true,
    ...(status     && { status }),
    ...(officeId   && { officeId }),
    ...(districtId && { office: { districtId } }),
    ...(stateId    && { office: { district: { stateId } } }),
  };

  const [cameras, total] = await Promise.all([
    prisma.camera.findMany({
      where,
      select: cameraSelect,
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.camera.count({ where }),
  ]);

  res.json({
    success: true,
    data: cameras.map(formatCamera),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  });
});

// ============================================================
// GET /api/cameras/:id — single camera
// ============================================================
const getCameraById = asyncHandler(async (req, res) => {
  const hasAccess = await checkCameraAccess(req, req.params.id);
  if (!hasAccess) throw new ForbiddenError('You do not have access to this camera');

  const camera = await prisma.camera.findUnique({
    where: { id: req.params.id },
    select: cameraSelect,
  });
  if (!camera) throw new NotFoundError('Camera not found');

  res.json({ success: true, data: formatCamera(camera) });
});

// ============================================================
// GET /api/cameras/:id/stream — get HLS URL for live playback
// Logs VIEW_STREAM to audit trail
// ============================================================
const getStreamUrl = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const hasAccess = await checkCameraAccess(req, id);
  if (!hasAccess) throw new ForbiddenError('You do not have access to this camera');

  const camera = await prisma.camera.findUnique({
    where: { id },
    select: { id: true, name: true, streamUrl: true, streamType: true, status: true, isActive: true },
  });

  if (!camera)          throw new NotFoundError('Camera not found');
  if (!camera.isActive) throw new NotFoundError('Camera is inactive');

  // Validate stream URL
  const validation = validateStreamUrl(camera.streamUrl);
  if (!validation.valid) {
    return res.json({
      success: false,
      data: { message: `Invalid stream URL: ${validation.error}` },
    });
  }

  if (camera.status !== 'ACTIVE') {
    return res.json({
      success: false,
      data: {
        message: `Camera is ${camera.status.toLowerCase()} — stream not available`,
        status: camera.status,
      },
    });
  }

  const hlsUrl = generateHlsUrl(camera.streamUrl);

  // Log access to audit trail
  await logAudit({
    userId:   req.user.userId,
    action:   'VIEW_STREAM',
    cameraId: id,
    metadata: { cameraName: camera.name, streamType: camera.streamType },
    req,
  });

  res.json({
    success: true,
    data: {
      hlsUrl,
      streamType:     camera.streamType,
      status:         camera.status,
      mediaMtxServer: env.mediaMtx.server,
    },
  });
});

// ============================================================
// POST /api/cameras — create camera
// ============================================================
const createCamera = asyncHandler(async (req, res) => {
  const { name, description, streamUrl, streamType, status, officeId } = req.body;

  // Validate office exists
  const office = await prisma.office.findUnique({ where: { id: officeId } });
  if (!office) throw new ValidationError('officeId does not reference an existing office');

  // Validate stream URL
  const validation = validateStreamUrl(streamUrl);
  if (!validation.valid) throw new ValidationError(validation.error);

  // Auto-detect stream type if not provided
  const resolvedType = streamType || detectStreamType(streamUrl);

  const camera = await prisma.camera.create({
    data: {
      name,
      description,
      streamUrl,
      streamType: resolvedType,
      status: status || 'ACTIVE',
      officeId,
    },
    select: cameraSelect,
  });

  await logAudit({
    userId:   req.user.userId,
    action:   'CREATE_CAMERA',
    cameraId: camera.id,
    metadata: { name, streamType: resolvedType, officeId },
    req,
  });

  res.status(201).json({ success: true, data: formatCamera(camera) });
});

// ============================================================
// PATCH /api/cameras/:id — update camera
// ============================================================
const updateCamera = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, streamUrl, streamType, status, officeId, isActive } = req.body;

  const existing = await prisma.camera.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Camera not found');

  if (officeId) {
    const office = await prisma.office.findUnique({ where: { id: officeId } });
    if (!office) throw new ValidationError('officeId does not reference an existing office');
  }

  // Validate new stream URL if provided
  if (streamUrl) {
    const validation = validateStreamUrl(streamUrl);
    if (!validation.valid) throw new ValidationError(validation.error);
  }

  // Auto-detect stream type from new URL if URL changed but type not specified
  const resolvedType = streamType || (streamUrl ? detectStreamType(streamUrl) : undefined);

  const camera = await prisma.camera.update({
    where: { id },
    data: {
      ...(name              !== undefined && { name }),
      ...(description       !== undefined && { description }),
      ...(streamUrl         !== undefined && { streamUrl }),
      ...(resolvedType      !== undefined && { streamType: resolvedType }),
      ...(status            !== undefined && { status }),
      ...(officeId          !== undefined && { officeId }),
      ...(isActive          !== undefined && { isActive }),
    },
    select: cameraSelect,
  });

  await logAudit({
    userId:   req.user.userId,
    action:   'UPDATE_CAMERA',
    cameraId: id,
    metadata: { changes: req.body },
    req,
  });

  res.json({ success: true, data: formatCamera(camera) });
});

// ============================================================
// DELETE /api/cameras/:id — soft delete
// ============================================================
const deleteCamera = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const existing = await prisma.camera.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Camera not found');

  await prisma.camera.update({
    where: { id },
    data: { isActive: false, status: 'INACTIVE' },
  });

  await logAudit({
    userId:   req.user.userId,
    action:   'DELETE_CAMERA',
    cameraId: id,
    metadata: { name: existing.name },
    req,
  });

  res.json({ success: true, data: { message: `Camera "${existing.name}" deactivated` } });
});

module.exports = {
  getCameras,
  getCameraById,
  getStreamUrl,
  createCamera,
  updateCamera,
  deleteCamera,
};
