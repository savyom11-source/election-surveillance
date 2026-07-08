// ============================================================
// UPLOAD ROUTES — /api/upload/*
// ============================================================

const express = require('express');
const router = express.Router();
const multer = require('multer');

const uploadController = require('../controllers/upload.controller');
const { authenticate, requireRole } = require('../middleware/authenticate');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel files are allowed.'));
    }
  }
});

router.use(authenticate);

// Only SUPER_ADMIN can perform bulk uploads
router.post('/cameras', requireRole(['SUPER_ADMIN']), upload.single('file'), uploadController.bulkUploadCameras);

module.exports = router;
