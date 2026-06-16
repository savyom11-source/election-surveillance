// ============================================================
// CAMERA ROUTES — /api/cameras/*
// Read: any authenticated user (scoped to their access)
// Write (create/update/delete): SUPER_ADMIN only
// ============================================================

const express = require('express');
const router = express.Router();

const cameraController = require('../controllers/camera.controller');
const { authenticate } = require('../middleware/authenticate');
const { requireRole, loadUserScope } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const { createCameraSchema, updateCameraSchema } = require('../validators/camera.validator');

// All routes require auth + scope
router.use(authenticate, loadUserScope);

// Read — accessible to all roles (filtered by scope)
router.get('/', cameraController.getCameras);
router.get('/:id', cameraController.getCameraById);
router.get('/:id/stream', cameraController.getCameraStream);

// Write — SUPER_ADMIN only
router.post('/', requireRole('SUPER_ADMIN'), validate(createCameraSchema), cameraController.createCamera);
router.patch('/:id', requireRole('SUPER_ADMIN'), validate(updateCameraSchema), cameraController.updateCamera);
router.delete('/:id', requireRole('SUPER_ADMIN'), cameraController.deleteCamera);

module.exports = router;
