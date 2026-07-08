// ============================================================
// RECORDING CONTROLLER — S3 recordings: list + signed URL playback
// ============================================================

const { S3Client, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const prisma = require('../config/prisma');
const env = require('../config/env');
const { NotFoundError, ForbiddenError, asyncHandler } = require('../utils/errors');
const { checkCameraAccess } = require('../middleware/rbac');
const { buildCameraScopeFilter } = require('../middleware/rbac');
const { logAudit } = require('../services/audit.service');

// Lazy-init S3 client — only created when AWS creds are present
let s3Client = null;
function getS3Client() {
  if (!s3Client && env.aws.accessKeyId && env.aws.secretAccessKey) {
    s3Client = new S3Client({
      region: env.aws.region,
      credentials: {
        accessKeyId: env.aws.accessKeyId,
        secretAccessKey: env.aws.secretAccessKey,
      },
    });
  }
  return s3Client;
}

// Signed URL expires in 1 hour
const SIGNED_URL_EXPIRY_SECONDS = 3600;

// ----------------------------------------------------------
// GET /api/recordings
// List recordings, filtered by scope + optional camera/date range
// Query: ?cameraId=&officeId=&districtId=&stateId=&from=&to=&page=&limit=
// ----------------------------------------------------------
const getRecordings = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
  const { cameraId, officeId, districtId, stateId, from, to } = req.query;

  const scopeFilter = buildCameraScopeFilter(req.scope);

  const cameraWhere = {
    ...scopeFilter,
    isActive: true,
    ...(officeId && { officeId }),
    ...(districtId && { office: { districtId } }),
    ...(stateId && { office: { district: { stateId } } }),
  };

  // Get camera IDs the user is allowed to see
  const accessibleCameras = await prisma.camera.findMany({
    where: cameraWhere,
    select: { id: true },
  });

  const accessibleCameraIds = accessibleCameras.map((c) => c.id);

  const recordingWhere = {
    cameraId: {
      in: cameraId
        ? accessibleCameraIds.filter((id) => id === cameraId)
        : accessibleCameraIds,
    },
    status: 'AVAILABLE',
    ...(from && { recordedAt: { gte: new Date(from) } }),
    ...(to && { recordedAt: { lte: new Date(to) } }),
  };

  const [recordings, total] = await Promise.all([
    prisma.recording.findMany({
      where: recordingWhere,
      orderBy: { recordedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        filename: true,
        durationSec: true,
        fileSizeMb: true,
        status: true,
        recordedAt: true,
        createdAt: true,
        camera: {
          select: {
            id: true,
            name: true,
            office: {
              select: {
                id: true,
                name: true,
                district: {
                  select: {
                    id: true,
                    name: true,
                    state: { select: { id: true, name: true, code: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.recording.count({ where: recordingWhere }),
  ]);

  res.json({
    success: true,
    data: recordings,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  });
});

// ----------------------------------------------------------
// GET /api/recordings/:id/play
// Returns a time-limited signed S3 URL for playback
// ----------------------------------------------------------
const getRecordingPlayUrl = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const recording = await prisma.recording.findUnique({
    where: { id },
    select: {
      id: true,
      s3Key: true,
      s3Bucket: true,
      filename: true,
      status: true,
      cameraId: true,
    },
  });

  if (!recording || recording.status !== 'AVAILABLE') {
    throw new NotFoundError('Recording not found or unavailable');
  }

  // Verify user has access to the camera this recording belongs to
  const hasAccess = await checkCameraAccess(req, recording.cameraId);
  if (!hasAccess) throw new ForbiddenError('You do not have access to this recording');

  const s3 = getS3Client();

  // If AWS not configured yet, return placeholder message
  if (!s3) {
    return res.json({
      success: false,
      data: {
        message: 'AWS S3 not configured yet. Recording playback will be available once AWS is set up.',
        recordingId: id,
        filename: recording.filename,
      },
    });
  }

  const command = new GetObjectCommand({
    Bucket: recording.s3Bucket,
    Key: recording.s3Key,
  });

  const signedUrl = await getSignedUrl(s3, command, {
    expiresIn: SIGNED_URL_EXPIRY_SECONDS,
  });

  await logAudit({
    userId: req.user.userId,
    action: 'VIEW_RECORDING',
    cameraId: recording.cameraId,
    metadata: { recordingId: id, filename: recording.filename },
    req,
  });

  res.json({
    success: true,
    data: {
      recordingId: id,
      filename: recording.filename,
      playUrl: signedUrl,
      expiresInSeconds: SIGNED_URL_EXPIRY_SECONDS,
    },
  });
});

module.exports = {
  getRecordings,
  getRecordingPlayUrl,
};
