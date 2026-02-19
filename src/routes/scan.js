// src/routes/scans.js

const express = require('express');
const router = express.Router();
const scanController = require('../controllers/scanController');
const { protect, optionalAuth } = require('../middleware/auth');
const multer = require('multer');

const upload = multer({ 
  dest: 'uploads/apks/',
  limits: { fileSize: 100 * 1024 * 1024 }
});

router.post('/web', optionalAuth, scanController.startWebScan);
router.post('/mobile', optionalAuth, upload.single('apk'), scanController.startMobileScan);
router.post('/repository', protect, scanController.startRepositoryScan);

router.get('/', protect, scanController.listScans);
router.get('/:id', optionalAuth, scanController.getScan);
router.delete('/:id', protect, scanController.deleteScan);
// Add this route to scan.js
router.delete('/:id/cancel', protect, scanController.cancelScan);

module.exports = router;













