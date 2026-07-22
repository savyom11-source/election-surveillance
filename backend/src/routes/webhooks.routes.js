// ============================================================
// WEBHOOKS ROUTES — /api/webhooks/*
// ============================================================

const express = require('express');
const router = express.Router();
const webhooksController = require('../controllers/webhooks.controller');

// MediaMTX webhooks (no auth required, MediaMTX pushes to these locally)
router.post('/mediamtx/ready', webhooksController.handleMediaMtxReady);
router.post('/mediamtx/notready', webhooksController.handleMediaMtxNotReady);

module.exports = router;
