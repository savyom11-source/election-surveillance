// ============================================================
// RECORDING ROUTES — /api/recordings/*
// ============================================================

const express = require('express');
const router = express.Router();

const recordingController = require('../controllers/recording.controller');
const { authenticate } = require('../middleware/authenticate');
const { requireRole, loadUserScope } = require('../middleware/rbac');

router.use(authenticate, loadUserScope);

// List recordings filtered by user scope + date/location filters
router.get('/', recordingController.getRecordings);

// Get signed S3 URL for a specific recording
router.get('/:id/play', recordingController.getRecordingPlayUrl);

module.exports = router;
