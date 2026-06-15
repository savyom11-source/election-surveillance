// ============================================================
// AUDIT SERVICE — Logs sensitive actions to audit_logs table
// Called from controllers after auth/access decisions
// ============================================================

const prisma = require('../config/prisma');

/**
 * Log an action to the audit trail.
 * Never throws — audit failures shouldn't break the main request.
 *
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.action - one of AuditAction enum values
 * @param {string} [params.cameraId]
 * @param {Object} [params.metadata]
 * @param {Object} [params.req] - Express request, used to extract IP/UA
 */
async function logAudit({ userId, action, cameraId = null, metadata = null, req = null }) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        cameraId,
        metadata: metadata || undefined,
        ipAddress: req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress) : null,
        userAgent: req ? req.headers['user-agent'] : null,
      },
    });
  } catch (err) {
    // Audit logging should never break the main flow
    console.error('⚠️ Audit log write failed:', err.message);
  }
}

module.exports = { logAudit };
