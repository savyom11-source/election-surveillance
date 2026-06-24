const { z } = require('zod');

const STREAM_STATUSES = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'];
const STREAM_TYPES    = ['RTMP', 'RTSP'];

function validateStreamUrl(url, streamType) {
  if (!url) return false;
  const type = (streamType || 'RTMP').toUpperCase();
  if (type === 'RTMP') return url.startsWith('rtmp://');
  if (type === 'RTSP') return url.startsWith('rtsp://');
  return false;
}

const createCameraSchema = z.object({
  name:        z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  streamUrl:   z.string().min(1, 'Stream URL is required'),
  streamType:  z.enum(STREAM_TYPES).default('RTMP'),
  status:      z.enum(STREAM_STATUSES).optional(),
  officeId:    z.string().uuid('Invalid officeId'),
}).superRefine((data, ctx) => {
  if (!validateStreamUrl(data.streamUrl, data.streamType)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Stream URL must start with ${data.streamType === 'RTSP' ? 'rtsp://' : 'rtmp://'}`,
      path: ['streamUrl'],
    });
  }
});

const updateCameraSchema = z.object({
  name:        z.string().min(2).optional(),
  description: z.string().optional(),
  streamUrl:   z.string().min(1).optional(),
  streamType:  z.enum(STREAM_TYPES).optional(),
  status:      z.enum(STREAM_STATUSES).optional(),
  officeId:    z.string().uuid('Invalid officeId').optional(),
  isActive:    z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (data.streamUrl && data.streamType) {
    if (!validateStreamUrl(data.streamUrl, data.streamType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Stream URL must start with ${data.streamType === 'RTSP' ? 'rtsp://' : 'rtmp://'}`,
        path: ['streamUrl'],
      });
    }
  }
});

module.exports = { STREAM_STATUSES, STREAM_TYPES, createCameraSchema, updateCameraSchema };
