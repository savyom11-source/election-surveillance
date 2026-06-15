// ============================================================
// AUTH ROUTES — /api/auth/*
// ============================================================

const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/authenticate');
const {
  validate,
  loginSchema,
  refreshSchema,
  changePasswordSchema,
} = require('../validators/auth.validator');

// Public routes
router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshSchema), authController.refresh);
router.post('/logout', validate(refreshSchema), authController.logout);

// Protected routes
router.get('/me', authenticate, authController.me);
router.post('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword);

module.exports = router;
