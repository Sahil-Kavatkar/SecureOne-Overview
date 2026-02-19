// src/routes/github.js - ADD NEW ROUTES

const express = require('express');
const router = express.Router();
const githubController = require('../controllers/githubController');
const { protect } = require('../middleware/auth');

router.get('/repos', protect, githubController.listRepositories.bind(githubController));
router.get('/repos/:owner/:repo', protect, githubController.getRepository.bind(githubController));
router.get('/repos/:owner/:repo/tree/:branch?', protect, githubController.getRepositoryTree.bind(githubController));
router.get('/repos/:owner/:repo/contents/*', protect, githubController.getFileContent.bind(githubController));
router.get('/repos/:owner/:repo/branches', protect, githubController.listBranches.bind(githubController));

// ✅ NEW: Create security issues
router.post('/issues/create', protect, githubController.createSecurityIssues.bind(githubController));

// ✅ FIXED: Create PR with issue linking
router.post('/pr/create', protect, githubController.createPullRequest.bind(githubController));

module.exports = router;