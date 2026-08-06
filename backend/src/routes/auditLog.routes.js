// ============================================================
// AUDIT LOG ROUTES — /api/audit-logs (Super Admin only)
// ============================================================

const express = require('express');
const router  = express.Router();

const { getAuditLogs } = require('../controllers/auditLog.controller');
const { authenticate } = require('../middleware/authenticate');
const { requireRole, loadUserScope } = require('../middleware/rbac');

router.use(authenticate, loadUserScope, requireRole('SUPER_ADMIN', 'STATE_ADMIN'));

router.get('/', getAuditLogs);

module.exports = router;
