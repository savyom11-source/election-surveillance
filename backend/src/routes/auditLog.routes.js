// ============================================================
// AUDIT LOG ROUTES — /api/audit-logs (Super Admin only)
// ============================================================

const express = require('express');
const router  = express.Router();

const { getAuditLogs } = require('../controllers/auditLog.controller');
const { authenticate } = require('../middleware/authenticate');
const { requireRole }  = require('../middleware/rbac');

router.use(authenticate, requireRole('SUPER_ADMIN'));

router.get('/', getAuditLogs);

module.exports = router;
