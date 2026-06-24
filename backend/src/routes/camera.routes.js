// ============================================================
// CAMERA ROUTES — /api/cameras/*
// ============================================================

const express = require('express');
const router  = express.Router();

const {
  getCameras,
  getCameraById,
  getStreamUrl,
  createCamera,
  updateCamera,
  deleteCamera,
} = require('../controllers/camera.controller');

const { authenticate }  = require('../middleware/authenticate');
const { requireRole, loadUserScope } = require('../middleware/rbac');
const { validate }      = require('../middleware/validate');
const { createCameraSchema, updateCameraSchema } = require('../validators/camera.validator');

// All routes require authentication + scope loaded
router.use(authenticate, loadUserScope);

// Read routes — available to all authenticated users (scope-filtered)
router.get('/',    getCameras);
router.get('/:id', getCameraById);
router.get('/:id/stream', getStreamUrl);

// Write routes — Super Admin only
router.post('/',    requireRole('SUPER_ADMIN'), validate(createCameraSchema), createCamera);
router.patch('/:id', requireRole('SUPER_ADMIN'), validate(updateCameraSchema), updateCamera);
router.delete('/:id', requireRole('SUPER_ADMIN'), deleteCamera);

module.exports = router;
