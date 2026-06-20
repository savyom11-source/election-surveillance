// ============================================================
// AUDIT LOG CONTROLLER — View audit logs (Super Admin only)
// ============================================================

const prisma = require('../config/prisma');
const { asyncHandler } = require('../utils/errors');

const getAuditLogs = asyncHandler(async (req, res) => {
  const page  = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 30, 1), 100);
  const { action, search, from, to } = req.query;

  const where = {};

  if (action) where.action = action;

  if (from || to) {
    where.createdAt = {
      ...(from && { gte: new Date(from) }),
      ...(to   && { lte: new Date(to)   }),
    };
  }

  if (search) {
    where.user = {
      OR: [
        { name:  { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        action: true,
        ipAddress: true,
        metadata: true,
        createdAt: true,
        user:   { select: { id: true, name: true, email: true, role: true } },
        camera: { select: { id: true, name: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({
    success: true,
    data: logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
});

module.exports = { getAuditLogs };
