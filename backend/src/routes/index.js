// ============================================================
// ROUTES INDEX — Mounts all route modules under /api
// ============================================================

const express = require('express');
const router = express.Router();

const authRoutes      = require('./auth.routes');
const userRoutes      = require('./user.routes');
const locationRoutes  = require('./location.routes');
const cameraRoutes    = require('./camera.routes');
const recordingRoutes = require('./recording.routes');

router.use('/auth',       authRoutes);
router.use('/users',      userRoutes);
router.use('/locations',  locationRoutes);
router.use('/cameras',    cameraRoutes);
router.use('/recordings', recordingRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

module.exports = router;
