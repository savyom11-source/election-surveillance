// ============================================================
// VALIDATORS — Camera CRUD schemas
// ============================================================

const { z } = require('zod');

const STREAM_STATUSES = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'];

const createCameraSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  rtspUrl: z.string().min(1, 'rtspUrl is required'),
  hlsUrl: z.string().optional(),
  status: z.enum(STREAM_STATUSES).optional(),
  officeId: z.string().uuid('Invalid officeId'),
});

const updateCameraSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  rtspUrl: z.string().min(1).optional(),
  hlsUrl: z.string().optional(),
  status: z.enum(STREAM_STATUSES).optional(),
  officeId: z.string().uuid('Invalid officeId').optional(),
  isActive: z.boolean().optional(),
});

module.exports = {
  STREAM_STATUSES,
  createCameraSchema,
  updateCameraSchema,
};
