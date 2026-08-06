// ============================================================
// USER ROUTES — /api/users/*
// All routes require: authenticated + SUPER_ADMIN role
// ============================================================

const express = require('express');
const router = express.Router();

const userController = require('../controllers/user.controller');
const { authenticate } = require('../middleware/authenticate');
const { requireRole, loadUserScope } = require('../middleware/rbac');
const {
  validate,
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
} = require('../validators/user.validator');

// Gate the entire router — Super and State Admins manage users
router.use(authenticate, loadUserScope, requireRole('SUPER_ADMIN', 'STATE_ADMIN'));

router.get('/', userController.getUsers);
router.post('/', validate(createUserSchema), userController.createUser);

router.get('/:id', userController.getUserById);
router.patch('/:id', validate(updateUserSchema), userController.updateUser);

router.patch('/:id/deactivate', userController.deactivateUser);
router.patch('/:id/activate', userController.activateUser);
router.patch('/:id/reset-password', validate(resetPasswordSchema), userController.resetPassword);
router.delete('/:id', userController.deleteUser);

module.exports = router;
