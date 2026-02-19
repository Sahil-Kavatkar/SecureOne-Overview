// src/routes/ai.js

const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { protect, optionalAuth } = require('../middleware/auth');

router.post('/explain', optionalAuth, aiController.explainVulnerability.bind(aiController));
router.post('/fix', optionalAuth, aiController.generateFix.bind(aiController));
// router.post('/apply-fix', protect, aiController.applyFix.bind(aiController));
router.post('/apply-fix', protect, aiController.generateFix.bind(aiController));
router.post('/map-repo', protect, aiController.mapVulnerabilities.bind(aiController));


module.exports = router;