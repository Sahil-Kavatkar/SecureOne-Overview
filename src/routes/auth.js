// src/routes/auth.js

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', protect, authController.getMe);
router.post('/logout', protect, authController.logout);

// GitHub OAuth
router.get('/github', authController.githubAuth);
router.get('/github/callback', authController.githubCallback);
router.post('/github/disconnect', protect, authController.disconnectGithub);

module.exports = router;