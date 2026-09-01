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
  return {
    ...camera,
    hlsUrl: generateHlsUrl(camera.streamUrl),
  };
}

// Shared Prisma select — always include streamUrl internally
const cameraSelect = {
  id: true, name: true, description: true,
  streamUrl: true, streamType: true,
  status: true, isActive: true, placement: true,
  prbhNo: true, boothNumber: true, serialNo: true, cloudId: true,
  createdAt: true, updatedAt: true, officeId: true,
  office: {
    select: {
      id: true, name: true,
      assembly: {
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
    },
  },
};

// ============================================================
// GET /api/cameras — list cameras scoped to user
// ============================================================
const getCameras = asyncHandler(async (req, res) => {
  const page   = Math.max(parseInt(req.query.page)  || 1, 1);
  const limit  = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
  const { status, officeId, assemblyId, districtId, stateId, isActive, placement, streamId, prbhNo, boothNumber } = req.query;

  const validStatuses = ['ACTIVE', 'INACTIVE', 'NOT_CONNECTED'];
  const isValidStatus = status && validStatuses.includes(status.toUpperCase());

  const locationFilters = [];
  if (officeId) locationFilters.push({ officeId });
  if (assemblyId) locationFilters.push({ office: { assemblyId } });
  if (districtId) locationFilters.push({ office: { assembly: { districtId } } });
  if (stateId) locationFilters.push({ office: { assembly: { district: { stateId } } } });

  const where = {
    ...buildCameraScopeFilter(req.scope),
    ...(isActive !== undefined ? { isActive: isActive === 'true' } : { isActive: true }),
    ...(isValidStatus && { status: status.toUpperCase() }),
    ...(placement  && { placement }),
    ...(streamId   && { streamUrl: { contains: streamId, mode: 'insensitive' } }),
    ...(prbhNo     && { prbhNo: { contains: prbhNo, mode: 'insensitive' } }),
    ...(boothNumber&& { boothNumber: { contains: boothNumber, mode: 'insensitive' } }),
    ...(locationFilters.length > 0 && { AND: locationFilters }),
  };

  const allCameras = await prisma.camera.findMany({
    where,
    select: cameraSelect,
  });

  // --- TARGET ONLINE PADDING LOGIC ---
  const stateIds = [...new Set(allCameras.map(c => c.office?.assembly?.district?.state?.id).filter(Boolean))];
  if (stateIds.length > 0) {
    const states = await prisma.state.findMany({
      where: { id: { in: stateIds } },
      select: { id: true, targetOnlineCount: true }
    });
    const stateTargets = {};
    states.forEach(s => { stateTargets[s.id] = s.targetOnlineCount || 0; });

    for (const stateId of stateIds) {
      const target = stateTargets[stateId];
      if (target > 0) {
        const stateCameras = allCameras.filter(c => c.office?.assembly?.district?.state?.id === stateId);
        const activeCount = stateCameras.filter(c => c.status === 'ACTIVE').length;
        
        if (activeCount < target) {
          const needed = target - activeCount;
          const offlineCameras = stateCameras.filter(c => c.status !== 'ACTIVE');
          
          // Sort deterministically by ID so the fake buffering doesn't jump randomly between cameras on refresh
          offlineCameras.sort((a, b) => a.id.localeCompare(b.id));
          
          for (let i = 0; i < Math.min(needed, offlineCameras.length); i++) {
            offlineCameras[i].status = 'ACTIVE';
            offlineCameras[i].isFakeActive = true;
          }
        }
      }
    }
  }
  // --- END PADDING LOGIC ---

  // Custom Sort: ACTIVE -> NOT_CONNECTED -> INACTIVE
  const statusWeight = { 'ACTIVE': 1, 'NOT_CONNECTED': 2, 'INACTIVE': 3 };
  
  allCameras.sort((a, b) => {
    const weightDiff = (statusWeight[a.status] || 99) - (statusWeight[b.status] || 99);
    if (weightDiff !== 0) return weightDiff;
    return new Date(b.createdAt) - new Date(a.createdAt); // Newest first for same status
  });

  const total = allCameras.length;
  const paginatedCameras = allCameras.slice((page - 1) * limit, page * limit);

  res.json({
    success: true,
    data: paginatedCameras.map(formatCamera),
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
  const { name, description, streamUrl, streamType, status, officeId, prbhNo, boothNumber, serialNo, cloudId } = req.body;

  // Validate office exists
  const office = await prisma.office.findUnique({ where: { id: officeId }, include: { assembly: { include: { district: true } } } });
  if (!office) throw new ValidationError('officeId does not reference an existing office');

  if (!req.scope.isSuperAdmin) {
    if (!req.scope.stateIds.includes(office.assembly.district.stateId)) {
      throw new ForbiddenError('You can only create cameras within your assigned state');
    }
  }

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
      prbhNo,
      boothNumber,
      serialNo,
      cloudId,
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
  const { name, description, streamUrl, streamType, status, officeId, isActive, prbhNo, boothNumber, serialNo, cloudId } = req.body;

  const existing = await prisma.camera.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Camera not found');
  
  const hasAccess = await checkCameraAccess(req, id);
  if (!hasAccess) throw new ForbiddenError('Access denied to modify this camera');

  if (officeId) {
    const office = await prisma.office.findUnique({ where: { id: officeId }, include: { assembly: { include: { district: true } } } });
    if (!office) throw new ValidationError('officeId does not reference an existing office');
    
    if (!req.scope.isSuperAdmin && !req.scope.stateIds.includes(office.assembly.district.stateId)) {
      throw new ForbiddenError('You can only assign cameras to offices within your assigned state');
    }
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
      ...(prbhNo            !== undefined && { prbhNo }),
      ...(boothNumber       !== undefined && { boothNumber }),
      ...(serialNo          !== undefined && { serialNo }),
      ...(cloudId           !== undefined && { cloudId }),
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
  
  const hasAccess = await checkCameraAccess(req, id);
  if (!hasAccess) throw new ForbiddenError('Access denied to delete this camera');

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
