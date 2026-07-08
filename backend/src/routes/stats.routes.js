// ============================================================
// STATS ROUTES — /api/stats/*
// ============================================================

const express = require('express');
const router = express.Router();

const statsController = require('../controllers/stats.controller');
const { authenticate } = require('../middleware/authenticate');
const { loadUserScope } = require('../middleware/rbac');

router.use(authenticate, loadUserScope);

// Get camera stats
router.get('/cameras', statsController.getCameraStats);

module.exports = router;
