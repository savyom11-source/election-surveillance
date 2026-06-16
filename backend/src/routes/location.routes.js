// ============================================================
// LOCATION ROUTES — /api/locations/*
// Read: any authenticated user (scoped to their access)
// Write (create/update/delete): SUPER_ADMIN only
// ============================================================

const express = require('express');
const router = express.Router();

const locationController = require('../controllers/location.controller');
const { authenticate } = require('../middleware/authenticate');
const { requireRole, loadUserScope } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const {
  createStateSchema,
  updateStateSchema,
  createDistrictSchema,
  updateDistrictSchema,
  createOfficeSchema,
  updateOfficeSchema,
} = require('../validators/location.validator');

// All routes require authentication + scope loaded
router.use(authenticate, loadUserScope);

// ---- Tree (full hierarchy in one call — used by frontend browser) ----
router.get('/tree', locationController.getLocationTree);

// ---- States ----
router.get('/states', locationController.getStates);
router.post('/states', requireRole('SUPER_ADMIN'), validate(createStateSchema), locationController.createState);
router.get('/states/:id', locationController.getStateById);
router.patch('/states/:id', requireRole('SUPER_ADMIN'), validate(updateStateSchema), locationController.updateState);
router.delete('/states/:id', requireRole('SUPER_ADMIN'), locationController.deleteState);

// ---- Districts ----
router.get('/districts', locationController.getDistricts);
router.post('/districts', requireRole('SUPER_ADMIN'), validate(createDistrictSchema), locationController.createDistrict);
router.get('/districts/:id', locationController.getDistrictById);
router.patch('/districts/:id', requireRole('SUPER_ADMIN'), validate(updateDistrictSchema), locationController.updateDistrict);
router.delete('/districts/:id', requireRole('SUPER_ADMIN'), locationController.deleteDistrict);

// ---- Offices ----
router.get('/offices', locationController.getOffices);
router.post('/offices', requireRole('SUPER_ADMIN'), validate(createOfficeSchema), locationController.createOffice);
router.get('/offices/:id', locationController.getOfficeById);
router.patch('/offices/:id', requireRole('SUPER_ADMIN'), validate(updateOfficeSchema), locationController.updateOffice);
router.delete('/offices/:id', requireRole('SUPER_ADMIN'), locationController.deleteOffice);

module.exports = router;
