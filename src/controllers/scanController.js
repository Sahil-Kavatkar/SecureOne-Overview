// // src/controllers/scanController.js - Enhanced with Race Condition Fix

// const { spawn } = require('child_process');
// const path = require('path');
// const Scan = require('../models/Scan');
// const User = require('../models/User');
// const aiService = require('../services/aiService'); 

// class ScanController {
  
//   // ====================================================================
//   // 🚀 PUBLIC API ENDPOINTS
//   // ====================================================================

//   startWebScan = async (req, res, next) => {
//     try {
//       const { targetUrl, scanDepth = 'medium' } = req.body;
//       const userId = req.user?.id || null;

//       if (!this.isValidUrl(targetUrl)) {
//         return res.status(400).json({
//           success: false,
//           message: 'Invalid URL provided'
//         });
//       }

//       if (userId) {
//         const canScan = await this.checkRateLimit(userId);
//         if (!canScan) {
//           return res.status(429).json({
//             success: false,
//             message: 'Rate limit exceeded. Please try again later.'
//           });
//         }
//       }

//       const scan = await Scan.create({
//         userId,
//         scanType: 'web',
//         target: { url: targetUrl },
//         status: 'queued',
//         progress: 0
//       });

//       console.log(`🔍 Web scan started: ${scan._id} for ${targetUrl}`);

//       // ✅ FIX: Added 2-second delay to prevent race condition
//       // This gives the frontend time to receive the scanId, connect via Socket.io,
//       // and join the room BEFORE the Python script starts emitting logs.
//       setTimeout(() => {
//         this.executeWebScan(scan._id, targetUrl, scanDepth);
//       }, 2000);

//       res.status(202).json({
//         success: true,
//         message: 'Scan started successfully',
//         data: {
//           scanId: scan._id,
//           status: 'queued',
//           target: targetUrl
//         }
//       });
//     } catch (error) {
//       console.error('Start web scan error:', error);
//       next(error);
//     }
//   }

//   startMobileScan = async (req, res, next) => {
//     try {
//       const { apkUrl } = req.body;
//       const userId = req.user?.id || null;

//       if (!req.file && !apkUrl) {
//         return res.status(400).json({
//           success: false,
//           message: 'Please provide an APK file or URL'
//         });
//       }

//       const scan = await Scan.create({
//         userId,
//         scanType: 'mobile',
//         target: { apkUrl: apkUrl || req.file.path },
//         status: 'queued',
//         progress: 0
//       });

//       console.log(`📱 Mobile scan started: ${scan._id}`);

//       // Mobile scans take longer to init, so race condition is less likely, 
//       // but a small delay is safe practice.
//       setTimeout(() => {
//         this.executeMobileScan(scan._id, apkUrl || req.file.path);
//       }, 1000);

//       res.status(202).json({
//         success: true,
//         message: 'APK scan started successfully',
//         data: {
//           scanId: scan._id,
//           status: 'queued'
//         }
//       });
//     } catch (error) {
//       console.error('Start mobile scan error:', error);
//       next(error);
//     }
//   }

//   startRepositoryScan = async (req, res, next) => {
//     try {
//       const { repositoryUrl, branch = 'main' } = req.body;
//       const userId = req.user.id;

//       const user = await User.findById(userId);
//       if (!user.githubId) {
//         return res.status(403).json({
//           success: false,
//           message: 'Please connect your GitHub account first'
//         });
//       }

//       const scan = await Scan.create({
//         userId,
//         scanType: 'repository',
//         target: { repositoryUrl, branch },
//         status: 'queued',
//         progress: 0
//       });

//       console.log(`📦 Repository scan started: ${scan._id}`);

//       setTimeout(() => {
//         this.executeRepositoryScan(scan._id, repositoryUrl, branch, user);
//       }, 2000);

//       res.status(202).json({
//         success: true,
//         message: 'Repository scan started',
//         data: {
//           scanId: scan._id,
//           status: 'queued',
//           repository: repositoryUrl
//         }
//       });
//     } catch (error) {
//       console.error('Start repository scan error:', error);
//       next(error);
//     }
//   }

//   getScan = async (req, res, next) => {
//     try {
//       const { id } = req.params;
//       const userId = req.user?.id;

//       const scan = await Scan.findById(id);

//       if (!scan) {
//         return res.status(404).json({
//           success: false,
//           message: 'Scan not found'
//         });
//       }

//       if (scan.userId && userId && scan.userId.toString() !== userId) {
//         return res.status(403).json({
//           success: false,
//           message: 'Access denied'
//         });
//       }

//       res.json({
//         success: true,
//         data: { scan }
//       });
//     } catch (error) {
//       console.error('Get scan error:', error);
//       next(error);
//     }
//   }

//   listScans = async (req, res, next) => {
//     try {
//       const userId = req.user.id;
//       const { page = 1, limit = 10, scanType } = req.query;

//       const query = { userId };
//       if (scanType) query.scanType = scanType;

//       const scans = await Scan.find(query)
//         .sort({ createdAt: -1 })
//         .limit(limit * 1)
//         .skip((page - 1) * limit);

//       const total = await Scan.countDocuments(query);

//       res.json({
//         success: true,
//         data: {
//           scans,
//           pagination: {
//             page: parseInt(page),
//             limit: parseInt(limit),
//             total,
//             pages: Math.ceil(total / limit)
//           }
//         }
//       });
//     } catch (error) {
//       console.error('List scans error:', error);
//       next(error);
//     }
//   }

//   deleteScan = async (req, res, next) => {
//     try {
//       const { id } = req.params;
//       const userId = req.user.id;

//       const scan = await Scan.findById(id);

//       if (!scan) {
//         return res.status(404).json({
//           success: false,
//           message: 'Scan not found'
//         });
//       }

//       if (scan.userId.toString() !== userId) {
//         return res.status(403).json({
//           success: false,
//           message: 'Access denied'
//         });
//       }

//       await scan.deleteOne();

//       res.json({
//         success: true,
//         message: 'Scan deleted successfully'
//       });
//     } catch (error) {
//       console.error('Delete scan error:', error);
//       next(error);
//     }
//   }

//   cancelScan = async (req, res, next) => {
//     try {
//       const { id } = req.params;
//       const userId = req.user.id;

//       const scan = await Scan.findById(id);

//       if (!scan) {
//         return res.status(404).json({
//           success: false,
//           message: 'Scan not found'
//         });
//       }

//       if (scan.userId.toString() !== userId) {
//         return res.status(403).json({
//           success: false,
//           message: 'Access denied'
//         });
//       }

//       if (!['running', 'queued'].includes(scan.status)) {
//         return res.status(400).json({
//           success: false,
//           message: `Cannot cancel a ${scan.status} scan`
//         });
//       }

//       scan.status = 'cancelled';
//       scan.completedAt = new Date();
//       await scan.save();

//       this.emitLog(id, 'Scan cancelled by user');
//       this.emitComplete(id, { 
//         status: 'cancelled', 
//         message: 'Scan cancelled by user' 
//       });

//       console.log(`❌ Scan cancelled: ${id}`);

//       res.json({
//         success: true,
//         message: 'Scan cancelled successfully'
//       });
//     } catch (error) {
//       console.error('Cancel scan error:', error);
//       next(error);
//     }
//   }

//   // ====================================================================
//   // ⚙️ BACKGROUND WORKERS
//   // ====================================================================

//   executeWebScan(scanId, targetUrl, scanDepth) {
//     (async () => {
//       try {
//         const scan = await Scan.findById(scanId);
//         scan.status = 'running';
//         scan.startedAt = new Date();
//         await scan.save();

//         this.emitProgress(scanId, { status: 'running', progress: 5, message: 'Initializing scanner...' });

//         const workerPath = path.join(__dirname, '../workers/web-scanner.py');
//         const pythonProcess = spawn('python3', [workerPath, targetUrl, scanId, scanDepth]);

//         let outputData = '';

//         pythonProcess.stdout.on('data', (data) => {
//           const message = data.toString();
//           console.log(`[Python]: ${message.trim()}`);
//           outputData += message;
          
//           this.emitLog(scanId, message.trim());

//           const progressMatch = message.match(/PROGRESS:(\d+)/);
//           if (progressMatch) {
//             const progress = parseInt(progressMatch[1]);
//             this.emitProgress(scanId, {
//               status: 'running',
//               progress,
//               message: message.replace(/PROGRESS:\d+/, '').trim()
//             });
//           }
//         });

//         pythonProcess.stderr.on('data', (data) => {
//            console.error(`[Python Error]: ${data}`);
//         });

//         pythonProcess.on('close', async (code) => {
//           if (code === 0) {
//             try {
//               const lines = outputData.trim().split('\n');
//               const lastLine = lines[lines.length - 1];
//               const results = JSON.parse(lastLine);
              
//               scan.status = 'completed';
//               scan.completedAt = new Date();
//               scan.vulnerabilities = this.categorizeVulnerabilities(results.vulnerabilities || []);
//               scan.totalVulns = scan.vulnerabilities.length;
              
//               scan.criticalCount = scan.vulnerabilities.filter(v => v.severity === 'critical').length;
//               scan.highCount = scan.vulnerabilities.filter(v => v.severity === 'high').length;
//               scan.mediumCount = scan.vulnerabilities.filter(v => v.severity === 'medium').length;
//               scan.lowCount = scan.vulnerabilities.filter(v => v.severity === 'low').length;
              
//               scan.scanDuration = (scan.completedAt - scan.startedAt) / 1000;
//               await scan.save();

//               console.log('🤖 Generating AI explanation...');
//               aiService.generateSimplifiedReport(scan._id, scan.vulnerabilities)
//                 .then(() => {
//                    this.emitLog(scanId, "✅ AI Analysis Completed.");
//                    console.log(`[AI] Report generated for scan ${scanId}`);
//                 })
//                 .catch(err => console.error("AI Service Failed:", err));

//               this.emitComplete(scanId, {
//                 status: 'completed',
//                 totalVulns: scan.totalVulns,
//                 criticalCount: scan.criticalCount
//               });

//               console.log(`✅ Scan ${scanId} completed successfully.`);
//             } catch (parseError) {
//               console.error('Failed to parse Python results:', parseError);
//               scan.status = 'failed';
//               await scan.save();
//               this.emitError(scanId, { message: 'Failed to parse scan results' });
//             }
//           } else {
//             scan.status = 'failed';
//             scan.completedAt = new Date();
//             await scan.save();
//             this.emitError(scanId, { message: 'Scan process failed' });
//             console.error(`❌ Scan ${scanId} failed with exit code ${code}`);
//           }
//         });
//       } catch (error) {
//         console.error('Execute web scan error:', error);
//       }
//     })();
//   }

//   executeMobileScan(scanId, apkPath) {
//     (async () => {
//       try {
//         const scan = await Scan.findById(scanId);
//         scan.status = 'running';
//         scan.startedAt = new Date();
//         await scan.save();

//         this.emitProgress(scanId, { status: 'running', progress: 10, message: 'Starting MobSF...' });

//         const workerPath = path.join(__dirname, '../workers/mobile-scanner.py');
//         const pythonProcess = spawn('python3', [workerPath, apkPath, scanId]);

//         let outputData = '';

//         pythonProcess.stdout.on('data', (data) => {
//           const msg = data.toString();
//           console.log(`[Mobile]: ${msg.trim()}`);
//           outputData += msg;
//           this.emitLog(scanId, msg.trim());
//         });

//         pythonProcess.on('close', async (code) => {
//           if (code === 0) {
//             try {
//                const lines = outputData.trim().split('\n');
//                const lastLine = lines[lines.length - 1];
//                const results = JSON.parse(lastLine);
              
//               scan.status = 'completed';
//               scan.completedAt = new Date();
//               scan.vulnerabilities = results.vulnerabilities;
//               scan.totalVulns = results.vulnerabilities.length;
//               scan.appInfo = results.appInfo;
//               scan.securityScore = results.securityScore;
//               scan.scanDuration = (scan.completedAt - scan.startedAt) / 1000;
//               await scan.save();

//               this.emitComplete(scanId, { status: 'completed', totalVulns: scan.totalVulns });
//               console.log(`✅ Mobile scan ${scanId} completed`);
//             } catch (e) {
//                console.error("Mobile scan parse error", e);
//                scan.status = 'failed';
//                await scan.save();
//             }
//           } else {
//             scan.status = 'failed';
//             await scan.save();
//           }
//         });
//       } catch (error) {
//         console.error('Execute mobile scan error:', error);
//       }
//     })();
//   }

//   async executeRepositoryScan(scanId, repoUrl, branch, user) {
//     console.log('Repository scan implementation pending');
//   }

//   // ====================================================================
//   // 🛠️ HELPER METHODS
//   // ====================================================================

//   isValidUrl(url) {
//     try {
//       new URL(url);
//       return true;
//     } catch {
//       return false;
//     }
//   }

//   async checkRateLimit(userId) {
//     const user = await User.findById(userId);
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);

//     const scansToday = await Scan.countDocuments({
//       userId,
//       createdAt: { $gte: today }
//     });

//     return scansToday < user.permissions.maxScansPerDay;
//   }

//   categorizeVulnerabilities(vulnerabilities) {
//     return vulnerabilities.map(vuln => {
//       if (vuln.category) return vuln;

//       const name = vuln.name.toLowerCase();
//       const owaspKeywords = ['sql injection', 'xss', 'csrf', 'xxe', 'authentication'];
//       const brokenKeywords = ['500', 'error', 'ssl', 'deprecated', 'header'];
      
//       if (owaspKeywords.some(k => name.includes(k))) {
//         vuln.category = 'owasp';
//       } else if (brokenKeywords.some(k => name.includes(k))) {
//         vuln.category = 'broken';
//       } else {
//         vuln.category = 'ui';
//       }
      
//       return vuln;
//     });
//   }

//   emitProgress(scanId, data) {
//     if (global.io) global.io.to(`scan_${scanId}`).emit('scan_progress', data);
//   }

//   emitLog(scanId, logMessage) {
//     const logEntry = {
//       timestamp: new Date(),
//       message: logMessage,
//       type: 'log'
//     };

//     if (logMessage.includes('❌') || logMessage.includes('ERROR') || logMessage.match(/error/i)) {
//       logEntry.type = 'error';
//     } else if (logMessage.includes('✅') || logMessage.includes('SUCCESS') || logMessage.includes('completed')) {
//       logEntry.type = 'success';
//     } else if (logMessage.includes('⚠️') || logMessage.includes('WARNING')) {
//       logEntry.type = 'warning';
//     } else if (logMessage.includes('PROGRESS:') || logMessage.match(/progress:/i)) {
//       logEntry.type = 'progress';
//     }

//     if (global.io) {
//       global.io.to(`scan_${scanId}`).emit('scan_log', logEntry);
//     }
//   }

//   emitComplete(scanId, results) {
//     if (global.io) global.io.to(`scan_${scanId}`).emit('scan_complete', results);
//   }

//   emitError(scanId, error) {
//     if (global.io) global.io.to(`scan_${scanId}`).emit('scan_error', error);
//   }
// }

// module.exports = new ScanController();












// src/controllers/scanController.js

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { Octokit } = require('@octokit/rest'); 
const Scan = require('../models/Scan');
const User = require('../models/User');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ====================================================================
// 🤖 GEMINI-POWERED SAST ENGINE
// ====================================================================

class ScanController {
  
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.1,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    });
  }

  decryptToken(encrypted) {
    if (!encrypted) return null;
    try {
      return Buffer.from(encrypted, 'base64').toString('utf-8');
    } catch (e) {
      console.error('❌ Token decryption failed:', e.message);
      return null;
    }
  }

  // ====================================================================
  // 🚀 PUBLIC API ENDPOINTS
  // ====================================================================

  /**
   * Web Scanner - UNCHANGED (Uses ZAP)
   */
 // ====================================================================
// 🚀 WEB SCANNER - COMPLETE FIXED WITH AUTHENTICATION SUPPORT
// ====================================================================

startWebScan = async (req, res, next) => {
  try {
    const { 
      targetUrl, 
      scanDepth = 'medium',
      // Authentication settings
      authMethod = 'none',
      loginUrl,
      username,
      password,
      usernameField = 'username',
      passwordField = 'password',
      tokenHeader = 'Authorization',
      tokenValue
    } = req.body;

    const userId = req.user?.id || null;

    // Validate URL
    if (!this.isValidUrl(targetUrl)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid URL provided. Must include http:// or https://' 
      });
    }

    // Check rate limit for authenticated users
    if (userId) {
      const canScan = await this.checkRateLimit(userId);
      if (!canScan) {
        return res.status(429).json({ 
          success: false, 
          message: 'Rate limit exceeded. Please wait before starting another scan.' 
        });
      }
    }

    // Validate authentication configuration if enabled
    if (authMethod !== 'none') {
      if (authMethod === 'form' || authMethod === 'json') {
        if (!loginUrl) {
          return res.status(400).json({
            success: false,
            message: 'Login URL is required for form/JSON authentication'
          });
        }
        if (!username) {
          return res.status(400).json({
            success: false,
            message: 'Username is required for authentication'
          });
        }
        if (!password) {
          return res.status(400).json({
            success: false,
            message: 'Password is required for authentication'
          });
        }
        if (!this.isValidUrl(loginUrl)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid Login URL format. Must include http:// or https://'
          });
        }
      }

      if (authMethod === 'header') {
        if (!tokenHeader) {
          return res.status(400).json({
            success: false,
            message: 'Header name is required for token authentication'
          });
        }
        if (!tokenValue) {
          return res.status(400).json({
            success: false,
            message: 'Header value is required for token authentication'
          });
        }
      }
    }

    // Create scan record in database
    const scan = await Scan.create({
      userId,
      scanType: 'web',
      target: { url: targetUrl },
      status: 'queued',
      progress: 0,
      config: { 
        depth: scanDepth,
        // Store auth configuration
        auth: {
          method: authMethod,
          loginUrl: authMethod !== 'none' ? loginUrl : undefined,
          username: authMethod !== 'none' ? username : undefined,
          // Don't store plain password in logs, but we need it for the scanner
          usernameField,
          passwordField,
          tokenHeader: authMethod === 'header' ? tokenHeader : undefined,
          // Token value is stored temporarily for the scanner
        }
      }
    });

    // Log scan creation with auth status
    if (authMethod !== 'none') {
      console.log(`🔍 Web scan queued: ${scan._id} for ${targetUrl} with ${authMethod.toUpperCase()} authentication`);
      console.log(`👤 Authenticating as: ${username}`);
    } else {
      console.log(`🔍 Web scan queued: ${scan._id} for ${targetUrl} (public scan)`);
    }

    // Send immediate response to client
    res.status(202).json({
      success: true,
      message: 'Web scan started successfully',
      data: { 
        scanId: scan._id, 
        status: 'queued', 
        target: targetUrl,
        authEnabled: authMethod !== 'none',
        authMethod: authMethod
      }
    });

    // ✅ CRITICAL: Execute scan in background with authentication config
    setTimeout(() => {
      this.executeWebScan(
        scan._id, 
        targetUrl, 
        scanDepth,
        {  // Pass auth config as fourth parameter
          authMethod,
          loginUrl,
          username,
          password,
          usernameField,
          passwordField,
          tokenHeader,
          tokenValue
        }
      );
    }, 2000);

  } catch (error) { 
    console.error('Start web scan error:', error);
    next(error); 
  }
};

  /**
   * ✅ Mobile Scanner - COMPLETELY FIXED with live logs
   */
  startMobileScan = async (req, res, next) => {
    try {
      const { apkUrl } = req.body;
      const userId = req.user?.id || null;

      if (!req.file && !apkUrl) {
        return res.status(400).json({ success: false, message: 'Please provide an APK file or URL' });
      }

      const targetPath = req.file ? req.file.path : apkUrl;

      const scan = await Scan.create({
        userId,
        scanType: 'mobile',
        target: { apkUrl: targetPath },
        status: 'queued',
        progress: 0
      });

      console.log(`📱 Mobile scan queued: ${scan._id}`);
      
      res.status(202).json({
        success: true,
        message: 'APK scan started successfully',
        data: { scanId: scan._id, status: 'queued' }
      });

      // Execute mobile scan in background
      setTimeout(() => this.executeMobileScan(scan._id, targetPath), 1000);

    } catch (error) { next(error); }
  }

  /**
   * Repository Scanner - GEMINI POWERED
   */
  startRepositoryScan = async (req, res, next) => {
    try {
      const { repositoryUrl, repoUrl, url, branch = 'main', scanType = 'fullstack' } = req.body;
      const targetUrl = repositoryUrl || repoUrl || url;
      const userId = req.user.id;

      if (!targetUrl) return res.status(400).json({ success: false, message: 'Repository URL is required.' });

      const user = await User.findById(userId).select('+githubAccessToken');
      if (!user.githubId || !user.githubAccessToken) {
        return res.status(403).json({ success: false, message: 'Please connect your GitHub account first via the Dashboard.' });
      }

      const scan = await Scan.create({
        userId,
        scanType: 'repository',
        target: { repositoryUrl: targetUrl, branch },
        status: 'queued',
        progress: 0,
        repositoryScanType: scanType
      });

      console.log(`📦 Repository scan queued: ${scan._id} (Using Gemini AI)`);

      res.status(202).json({
        success: true,
        message: 'Repository scan started',
        data: { scanId: scan._id, status: 'queued', repository: targetUrl, scanType }
      });

      setTimeout(() => {
        this.executeGeminiRepositoryScan(scan._id, targetUrl, branch, user, scanType);
      }, 1000);

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Scan Details
   */
  getScan = async (req, res, next) => {
    try {
      const scan = await Scan.findById(req.params.id);
      if (!scan) return res.status(404).json({ success: false, message: 'Scan not found' });
      
      if (scan.vulnerabilities && scan.vulnerabilities.length > 0) {
        scan.vulnerabilities = this.sortVulnerabilitiesBySeverity(scan.vulnerabilities);
      }
      
      res.json({ success: true, data: { scan } });
    } catch (e) { 
      console.error('Get scan error:', e);
      next(e); 
    }
  }

  listScans = async (req, res, next) => {
    try {
      const { page = 1, limit = 10, scanType } = req.query;
      const query = { userId: req.user.id };
      if (scanType) query.scanType = scanType;
      
      const scans = await Scan.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip((page - 1) * limit);
        
      const total = await Scan.countDocuments(query);
      
      res.json({ success: true, data: { scans, pagination: { page, limit, total } } });
    } catch (e) { next(e); }
  }

  deleteScan = async (req, res, next) => {
    try {
      await Scan.findByIdAndDelete(req.params.id);
      res.json({ success: true, message: 'Scan deleted successfully' });
    } catch (e) { next(e); }
  }

  cancelScan = async (req, res, next) => {
    try {
      const scan = await Scan.findById(req.params.id);
      if (scan) {
        scan.status = 'cancelled';
        scan.completedAt = new Date();
        await scan.save();
        this.emitComplete(req.params.id, { status: 'cancelled', message: 'Scan cancelled by user' });
      }
      res.json({ success: true, message: 'Scan cancelled' });
    } catch (e) { next(e); }
  }

  // ====================================================================
  // ⚙️ WORKER: WEB SCAN (ZAP) - UNCHANGED
  // ====================================================================

 // Replace your existing executeWebScan with this version:

// ====================================================================
// ⚙️ WORKER: WEB SCAN (ZAP) - WITH AUTHENTICATION SUPPORT
// ====================================================================

executeWebScan(scanId, targetUrl, scanDepth, authConfig = {}) {
  console.log(`📍 [Web Worker] Starting scan ${scanId}`);
  console.log(`🔐 Auth Config:`, authConfig.authMethod || 'none');
  
  (async () => {
    try {
      const scan = await Scan.findById(scanId);
      if (!scan) {
        console.error(`❌ Scan ${scanId} not found`);
        return;
      }

      scan.status = 'running';
      scan.startedAt = new Date();
      await scan.save();

      // Emit initial progress
      this.emitProgress(scanId, { 
        status: 'running', 
        progress: 5, 
        message: 'Initializing DAST scanner...' 
      });
      
      this.emitLog(scanId, '🌐 Starting web security analysis...', 'info');
      this.emitLog(scanId, `🎯 Target: ${targetUrl}`, 'info');
      this.emitLog(scanId, `⚙️ Scan depth: ${scanDepth.toUpperCase()}`, 'info');
      
      // Log authentication status
      if (authConfig.authMethod && authConfig.authMethod !== 'none') {
        this.emitLog(scanId, `🔐 Authentication enabled: ${authConfig.authMethod.toUpperCase()}`, 'success');
        if (authConfig.username) {
          this.emitLog(scanId, `👤 User: ${authConfig.username}`, 'info');
        }
        if (authConfig.authMethod === 'form' || authConfig.authMethod === 'json') {
          this.emitLog(scanId, `🔑 Login URL: ${authConfig.loginUrl}`, 'info');
        }
        if (authConfig.authMethod === 'header') {
          this.emitLog(scanId, `🎫 Header: ${authConfig.tokenHeader}`, 'info');
        }
      } else {
        this.emitLog(scanId, `🌐 Public scan mode - No authentication`, 'info');
      }

      const workerPath = path.join(__dirname, '../workers/web-scanner.py');
      
      // Check if file exists
      if (!fs.existsSync(workerPath)) {
        throw new Error(`Web scanner not found at ${workerPath}`);
      }

      // ✅ CRITICAL: Set environment variables for authentication
      const env = {
        ...process.env,
        ZAP_AUTH_METHOD: authConfig.authMethod || 'none',
        ZAP_LOGIN_URL: authConfig.loginUrl || '',
        ZAP_USERNAME: authConfig.username || '',
        ZAP_PASSWORD: authConfig.password || '',
        ZAP_USERNAME_FIELD: authConfig.usernameField || 'username',
        ZAP_PASSWORD_FIELD: authConfig.passwordField || 'password',
        ZAP_TOKEN_HEADER: authConfig.tokenHeader || 'Authorization',
        ZAP_TOKEN_VALUE: authConfig.tokenValue || '',
        ZAP_LOGGED_IN_PATTERN: 'logout|dashboard|profile|welcome|account|my-account|admin',
        ZAP_LOGGED_OUT_PATTERN: 'login|signin|auth|unauthorized|forbidden'
      };

      // Spawn Python process with unbuffered output and environment variables
      const pythonProcess = spawn('python3', ['-u', workerPath, targetUrl, scanId, scanDepth], { env });

      let outputData = '';
      let hasError = false;

      pythonProcess.stdout.on('data', (data) => {
        const message = data.toString();
        outputData += message;
        
        const lines = message.split('\n').filter(l => l.trim());
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;
          
          console.log(`[Python]: ${trimmedLine}`);
          
          // Check if this is JSON output (skip logging it)
          if (trimmedLine.startsWith('{') && trimmedLine.endsWith('}')) {
            continue;
          }
          
          // Check for progress messages
          const progressMatch = trimmedLine.match(/PROGRESS:(\d+)/);
          if (progressMatch) {
            const progress = parseInt(progressMatch[1]);
            const logMessage = trimmedLine.replace(/PROGRESS:\d+\s*/, '').replace(/\[\d{2}:\d{2}:\d{2}\]/, '').trim();
            
            this.emitProgress(scanId, { 
              status: 'running', 
              progress, 
              message: logMessage || `Scanning... ${progress}%` 
            });
          } else {
            // Regular log message - determine type
            let logType = 'log';
            if (trimmedLine.includes('✅') || trimmedLine.includes('✓')) logType = 'success';
            else if (trimmedLine.includes('❌') || trimmedLine.includes('✗')) logType = 'error';
            else if (trimmedLine.includes('⚠️') || trimmedLine.includes('⚠')) logType = 'warning';
            else if (trimmedLine.includes('🔐') || trimmedLine.includes('🔓')) logType = 'info';
            else if (trimmedLine.includes('📊')) logType = 'info';
            else if (trimmedLine.includes('🕷️')) logType = 'info';
            else if (trimmedLine.includes('🎯')) logType = 'info';
            
            // Clean the message
            const cleanMessage = trimmedLine.replace(/\[\d{2}:\d{2}:\d{2}\]/, '').trim();
            if (cleanMessage) {
              this.emitLog(scanId, cleanMessage, logType);
            }
          }
        }
      });

      pythonProcess.stderr.on('data', (data) => {
        const errorMsg = data.toString();
        console.error(`[Python Stderr]: ${errorMsg}`);
        
        // Filter out common warnings
        if (!errorMsg.includes('DeprecationWarning') && 
            !errorMsg.includes('NotOpenSSLWarning') &&
            !errorMsg.includes('urllib3') &&
            !errorMsg.includes('LibreSSL')) {
          
          const lines = errorMsg.split('\n').filter(l => l.trim());
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine) {
              this.emitLog(scanId, `⚠️ ${trimmedLine}`, 'warning');
            }
          }
          hasError = true;
        }
      });

      pythonProcess.on('error', (err) => {
        console.error(`❌ [Spawn Error]: Failed to start Python.`, err);
        this.emitError(scanId, { 
          message: 'Server Configuration Error: Python3 not found or failed to start.' 
        });
        
        if (err.code === 'ENOENT') {
          this.emitLog(scanId, '❌ Python3 not found. Please install Python 3.', 'error');
        }
        
        scan.status = 'failed';
        scan.save();
      });

      pythonProcess.on('close', async (code) => {
        console.log(`[Web] Process exited with code ${code}`);
        
        if (code === 0 && !hasError) {
          try {
            // Find the last JSON line
            const lines = outputData.trim().split('\n');
            let lastJsonLine = null;
            
            for (let i = lines.length - 1; i >= 0; i--) {
              const line = lines[i].trim();
              if (line.startsWith('{') && line.endsWith('}')) {
                lastJsonLine = line;
                break;
              }
            }
            
            if (!lastJsonLine) {
              throw new Error('No JSON output found from scanner');
            }
            
            const results = JSON.parse(lastJsonLine);
            
            if (results.error) {
              throw new Error(results.error);
            }
            
            scan.status = 'completed';
            scan.completedAt = new Date();
            scan.vulnerabilities = results.vulnerabilities || [];
            scan.totalVulns = scan.vulnerabilities.length;
            
            scan.criticalCount = scan.vulnerabilities.filter(v => v.severity === 'critical').length;
            scan.highCount = scan.vulnerabilities.filter(v => v.severity === 'high').length;
            scan.mediumCount = scan.vulnerabilities.filter(v => v.severity === 'medium').length;
            scan.lowCount = scan.vulnerabilities.filter(v => v.severity === 'low').length;
            
            // Store scan metadata
            scan.metadata = {
              urlsScanned: results.urlsScanned || 0,
              authEnabled: results.authEnabled || false,
              authMethod: results.authMethod || 'none',
              scanDuration: scan.scanDuration
            };
            
            // Calculate duration
            if (scan.startedAt) {
              scan.scanDuration = (scan.completedAt - scan.startedAt) / 1000;
            }
            
            this.calculateRiskScore(scan);
            await scan.save();
            
            // Log summary
            this.emitLog(scanId, `✅ Scan completed! Found ${scan.totalVulns} vulnerabilities across ${results.urlsScanned || 0} URLs`, 'success');
            
            if (results.authEnabled) {
              this.emitLog(scanId, `🔐 Authenticated scan completed successfully`, 'success');
            }
            
            this.emitComplete(scanId, { 
              status: 'completed', 
              totalVulns: scan.totalVulns,
              criticalCount: scan.criticalCount,
              highCount: scan.highCount,
              mediumCount: scan.mediumCount,
              lowCount: scan.lowCount,
              urlsScanned: results.urlsScanned || 0,
              authEnabled: results.authEnabled || false
            });
            
          } catch (parseError) {
            console.error('JSON Parse Error:', parseError);
            this.emitError(scanId, { message: 'Failed to parse scan results from scanner engine' });
            this.emitLog(scanId, `❌ Error: ${parseError.message}`, 'error');
            
            scan.status = 'failed';
            await scan.save();
          }
        } else {
          console.log(`Process exited with code ${code}`);
          this.emitError(scanId, { message: `Scan process failed with exit code ${code}` });
          this.emitLog(scanId, `❌ Scan process exited with code ${code}`, 'error');
          
          scan.status = 'failed';
          await scan.save();
        }
      });

    } catch (error) { 
      console.error('Execute web scan error:', error);
      this.emitError(scanId, { message: error.message });
      this.emitLog(scanId, `❌ Error: ${error.message}`, 'error');
      
      try {
        const scan = await Scan.findById(scanId);
        if (scan) {
          scan.status = 'failed';
          await scan.save();
        }
      } catch (e) {}
    }
  })();
}

  // ====================================================================
  // ⚙️ WORKER: MOBILE SCAN (MobSF) - COMPLETELY FIXED WITH LIVE LOGS
  // ====================================================================

  // ====================================================================
// ⚙️ WORKER: MOBILE SCAN (MobSF) - COMPLETELY FIXED WITH LIVE LOGS & ERROR HANDLING
// ====================================================================

executeMobileScan(scanId, apkPath) {
  console.log(`📍 [Mobile Worker] Starting scan ${scanId}`);
  
  (async () => {
    try {
      const scan = await Scan.findById(scanId);
      if (!scan) {
        console.error(`❌ Scan ${scanId} not found`);
        return;
      }

      // Update scan status to running
      scan.status = 'running';
      scan.startedAt = new Date();
      await scan.save();

      // Emit initial progress
      this.emitProgress(scanId, { 
        status: 'running', 
        progress: 5, 
        message: 'Initializing MobSF scanner...' 
      });
      
      this.emitLog(scanId, '📱 Starting mobile security analysis...', 'info');
      this.emitLog(scanId, `📦 APK: ${apkPath.split('/').pop()}`, 'info');
      this.emitLog(scanId, `🔍 Using MobSF Docker container`, 'info');

      // Get worker script path
      const workerPath = path.join(__dirname, '../workers/mobile-scanner.py');
      
      // Check if file exists
      if (!fs.existsSync(workerPath)) {
        throw new Error(`Mobile scanner not found at ${workerPath}`);
      }

      // Make script executable
      try {
        fs.accessSync(workerPath, fs.constants.X_OK);
      } catch (e) {
        fs.chmodSync(workerPath, 0o755);
      }

      // Spawn Python process with unbuffered output
      const pythonProcess = spawn('python3', ['-u', workerPath, apkPath, scanId]);
      
      let outputData = '';
      let hasError = false;
      let jsonFound = false;

      // Handle stdout (normal logs)
      pythonProcess.stdout.on('data', (data) => {
        const message = data.toString();
        outputData += message;
        
        // Split by lines and process each line
        const lines = message.split('\n').filter(l => l.trim());
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;
          
          console.log(`[Mobile Python]: ${trimmedLine}`);
          
          // Check if this is JSON output (skip logging it)
          if (trimmedLine.startsWith('{') && trimmedLine.endsWith('}')) {
            jsonFound = true;
            continue;
          }
          
          // Check for progress messages
          const progressMatch = trimmedLine.match(/PROGRESS:(\d+)/);
          if (progressMatch) {
            const progress = parseInt(progressMatch[1]);
            // Clean the message - remove progress prefix and timestamp
            let logMessage = trimmedLine
              .replace(/PROGRESS:\d+\s*/, '')
              .replace(/\[\d{2}:\d{2}:\d{2}\]/, '')
              .trim();
            
            if (!logMessage) {
              logMessage = `Scanning... ${progress}%`;
            }
            
            this.emitProgress(scanId, { 
              status: 'running', 
              progress, 
              message: logMessage 
            });
          } else {
            // Regular log message - determine type
            let logType = 'log';
            if (trimmedLine.includes('✅') || trimmedLine.includes('✓') || trimmedLine.includes('success')) {
              logType = 'success';
            } else if (trimmedLine.includes('❌') || trimmedLine.includes('✗') || trimmedLine.includes('error')) {
              logType = 'error';
              hasError = true;
            } else if (trimmedLine.includes('⚠️') || trimmedLine.includes('⚠') || trimmedLine.includes('warn')) {
              logType = 'warning';
            } else if (trimmedLine.includes('🔍') || trimmedLine.includes('📤') || trimmedLine.includes('📊') || trimmedLine.includes('📋')) {
              logType = 'info';
            }
            
            // Clean the message - remove timestamp
            const cleanMessage = trimmedLine.replace(/\[\d{2}:\d{2}:\d{2}\]/, '').trim();
            if (cleanMessage) {
              this.emitLog(scanId, cleanMessage, logType);
            }
          }
        }
      });

      // Handle stderr (error logs)
      pythonProcess.stderr.on('data', (data) => {
        const errorMsg = data.toString();
        console.error(`[Mobile Stderr]: ${errorMsg}`);
        
        // Filter out common warnings that we can ignore
        if (!errorMsg.includes('NotOpenSSLWarning') && 
            !errorMsg.includes('DeprecationWarning') &&
            !errorMsg.includes('urllib3') &&
            !errorMsg.includes('LibreSSL')) {
          
          const lines = errorMsg.split('\n').filter(l => l.trim());
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine) {
              this.emitLog(scanId, `⚠️ ${trimmedLine}`, 'warning');
            }
          }
          hasError = true;
        }
      });

      // Handle process spawn errors
      pythonProcess.on('error', (err) => {
        console.error(`❌ [Mobile Spawn Error]`, err);
        this.emitError(scanId, { 
          message: 'Failed to start mobile scanner. Is Python3 installed?' 
        });
        
        if (err.code === 'ENOENT') {
          this.emitLog(scanId, '❌ Python3 not found. Please install Python 3.', 'error');
        } else {
          this.emitLog(scanId, `❌ Failed to start scanner: ${err.message}`, 'error');
        }
        
        scan.status = 'failed';
        scan.completedAt = new Date();
        scan.save();
      });

      // Handle process completion
      pythonProcess.on('close', async (code) => {
        console.log(`[Mobile] Process exited with code ${code}`);
        
        try {
          // Find the last JSON line in the output
          const lines = outputData.trim().split('\n');
          let lastJsonLine = null;
          
          for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.startsWith('{') && line.endsWith('}')) {
              lastJsonLine = line;
              break;
            }
          }
          
          if (!lastJsonLine) {
            throw new Error('No JSON output found from scanner. The Python script may have crashed.');
          }
          
          // Parse the JSON response
          const results = JSON.parse(lastJsonLine);
          
          // Check if scan failed explicitly
          if (results.scanFailed || results.error) {
            const errorMsg = results.error || (results.errors && results.errors.join(', ')) || 'Scan failed';
            
            this.emitLog(scanId, `❌ Scan failed: ${errorMsg}`, 'error');
            this.emitError(scanId, { message: errorMsg });
            
            scan.status = 'failed';
            scan.completedAt = new Date();
            
            // Still save any partial results
            scan.vulnerabilities = results.vulnerabilities || [];
            scan.totalVulns = scan.vulnerabilities.length;
            scan.appInfo = results.appInfo || {};
            scan.securityScore = results.securityScore || 0;
            
            await scan.save();
            
            this.emitComplete(scanId, { 
              status: 'failed', 
              message: errorMsg,
              totalVulns: scan.totalVulns
            });
            
            return;
          }
          
          // Check if results are cached
          if (results.cached) {
            this.emitLog(scanId, '📦 Using cached analysis results', 'info');
          }
          
          // Success! Save the results
          scan.status = 'completed';
          scan.completedAt = new Date();
          scan.vulnerabilities = results.vulnerabilities || [];
          scan.totalVulns = scan.vulnerabilities.length;
          
          // Calculate severity counts
          scan.criticalCount = scan.vulnerabilities.filter(v => v.severity === 'critical').length;
          scan.highCount = scan.vulnerabilities.filter(v => v.severity === 'high').length;
          scan.mediumCount = scan.vulnerabilities.filter(v => v.severity === 'medium').length;
          scan.lowCount = scan.vulnerabilities.filter(v => v.severity === 'low').length;
          
          // Save app info and security score
          scan.appInfo = results.appInfo || {
            appName: 'Unknown',
            packageName: 'Unknown',
            version: 'Unknown',
            minSdk: 'Unknown',
            targetSdk: 'Unknown'
          };
          
          scan.securityScore = results.securityScore || 0;
          
          // Calculate duration
          if (scan.startedAt) {
            scan.scanDuration = (scan.completedAt - scan.startedAt) / 1000;
          }
          
          await scan.save();
          
          // Log summary
          this.emitLog(scanId, `✅ Scan completed! Found ${scan.totalVulns} vulnerabilities`, 'success');
          
          if (scan.totalVulns > 0) {
            this.emitLog(scanId, `📊 Critical: ${scan.criticalCount}, High: ${scan.highCount}, Medium: ${scan.mediumCount}, Low: ${scan.lowCount}`, 'info');
          } else {
            this.emitLog(scanId, `🟢 No vulnerabilities found - your app is secure!`, 'success');
          }
          
          // Emit completion event
          this.emitComplete(scanId, { 
            status: 'completed', 
            totalVulns: scan.totalVulns,
            criticalCount: scan.criticalCount,
            highCount: scan.highCount,
            mediumCount: scan.mediumCount,
            lowCount: scan.lowCount,
            securityScore: scan.securityScore,
            appName: scan.appInfo?.appName || 'Unknown'
          });
          
        } catch (e) {
          console.error("Mobile JSON Parse Error:", e);
          
          let errorMessage = 'Failed to parse scan results';
          if (e.message) {
            errorMessage += `: ${e.message}`;
          }
          
          this.emitError(scanId, { message: errorMessage });
          this.emitLog(scanId, `❌ Error: ${errorMessage}`, 'error');
          
          // If we have partial output, log it for debugging
          if (outputData) {
            console.error('Raw output preview:', outputData.substring(0, 500));
          }
          
          scan.status = 'failed';
          scan.completedAt = new Date();
          await scan.save();
        }
      });

    } catch (error) {
      console.error('Execute mobile scan error:', error);
      
      // Emit error to frontend
      this.emitError(scanId, { message: error.message });
      this.emitLog(scanId, `❌ Error: ${error.message}`, 'error');
      
      // Update scan status in database
      try {
        const scan = await Scan.findById(scanId);
        if (scan) {
          scan.status = 'failed';
          scan.completedAt = new Date();
          await scan.save();
        }
      } catch (e) {
        console.error('Failed to update scan status:', e);
      }
    }
  })();
}

  // ====================================================================
  // ⚙️ WORKER: GEMINI-POWERED REPOSITORY SCAN
  // ====================================================================

  async executeGeminiRepositoryScan(scanId, repoUrl, branch, user, scanType) {
    console.log(`🤖 [Gemini Repo Worker] Starting AI-powered scan for ${scanId}`);
    
    this.emitLog(scanId, `🤖 Starting Gemini AI-powered security scan...`);
    this.emitLog(scanId, `📦 Repository: ${repoUrl}`);
    this.emitLog(scanId, `🌿 Branch: ${branch}`);
    this.emitLog(scanId, `🔍 Scan type: ${scanType}`);
    this.emitProgress(scanId, { status: 'running', progress: 5, message: 'Connecting to GitHub...' });
    
    try {
      const scan = await Scan.findById(scanId);
      if (!scan) return;

      scan.status = 'running';
      scan.startedAt = new Date();
      await scan.save();

      // 1. Decrypt GitHub Token
      const token = this.decryptToken(user.githubAccessToken);
      if (!token) {
        throw new Error('Failed to decrypt GitHub token. Please reconnect GitHub.');
      }

      const octokit = new Octokit({ auth: token });
      
      // Parse repository info
      const urlParts = repoUrl.replace(/\/$/, '').split('/');
      const repoName = urlParts[urlParts.length - 1].replace('.git', '');
      const owner = urlParts[urlParts.length - 2];

      this.emitLog(scanId, `✅ Connected to GitHub as ${user.githubUsername}`);
      this.emitProgress(scanId, { status: 'running', progress: 10, message: `Fetching repository contents...` });

      // 2. Get default branch if specified branch doesn't exist
      let targetBranch = branch;
      try {
        await octokit.git.getRef({ owner, repo: repoName, ref: `heads/${branch}` });
        this.emitLog(scanId, `🌿 Using branch: ${branch}`);
      } catch (e) {
        const { data: repoData } = await octokit.repos.get({ owner, repo: repoName });
        targetBranch = repoData.default_branch;
        this.emitLog(scanId, `🌿 Using default branch: ${targetBranch}`);
      }

      // 3. Get repository tree
      const { data: refData } = await octokit.git.getRef({ 
        owner, repo: repoName, ref: `heads/${targetBranch}` 
      });
      
      const { data: treeData } = await octokit.git.getTree({
        owner, repo: repoName, tree_sha: refData.object.sha, recursive: 'true'
      });

      // 4. Filter files by type and size
      const fileExtensions = {
        'frontend': ['.js', '.jsx', '.ts', '.tsx', '.vue', '.html', '.css', '.scss'],
        'backend': ['.js', '.ts', '.py', '.java', '.go', '.rb', '.php', '.cs'],
        'mobile': ['.java', '.kt', '.swift', '.dart', '.xml'],
        'fullstack': ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go', '.rb', '.php', '.html', '.css']
      };

      const allowedExts = fileExtensions[scanType] || fileExtensions['fullstack'];

      const filesToScan = treeData.tree
        .filter(item => item.type === 'blob')
        .filter(item => allowedExts.some(ext => item.path.endsWith(ext)))
        .filter(item => {
          const p = item.path.toLowerCase();
          return !p.includes('node_modules') && 
                 !p.includes('dist/') && 
                 !p.includes('build/') && 
                 !p.includes('.git/') &&
                 !p.includes('package-lock.json') && 
                 !p.includes('yarn.lock') &&
                 !p.includes('venv/') &&
                 !p.includes('env/') &&
                 !p.includes('__pycache__');
        })
        .filter(item => item.size < 200000)
        .slice(0, 50);

      this.emitLog(scanId, `📂 Analyzing ${filesToScan.length} files with Gemini AI...`);
      this.emitProgress(scanId, { status: 'running', progress: 20, message: `Gemini AI analyzing ${filesToScan.length} files...` });

      // 5. Process files in batches
      const BATCH_SIZE = 5;
      let allVulnerabilities = [];
      let processedCount = 0;

      for (let i = 0; i < filesToScan.length; i += BATCH_SIZE) {
        const batch = filesToScan.slice(i, i + BATCH_SIZE);
        
        this.emitLog(scanId, `🔎 Gemini analyzing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(filesToScan.length/BATCH_SIZE)}...`);
        
        const batchContents = await Promise.all(batch.map(async (file) => {
          try {
            const { data } = await octokit.repos.getContent({
              owner, repo: repoName, path: file.path, ref: targetBranch
            });
            
            if (data.content) {
              return {
                path: file.path,
                content: Buffer.from(data.content, 'base64').toString('utf-8').substring(0, 15000)
              };
            }
          } catch (e) {}
          return null;
        }));

        const validFiles = batchContents.filter(f => f !== null);

        for (const file of validFiles) {
          try {
            const vulnerabilities = await this.analyzeFileWithGemini(file.path, file.content);
            allVulnerabilities.push(...vulnerabilities);
            
            if (vulnerabilities.length > 0) {
              this.emitLog(scanId, `🐛 Found ${vulnerabilities.length} issues in ${file.path.split('/').pop()}`);
            }
          } catch (e) {
            console.error(`Gemini analysis failed for ${file.path}:`, e);
          }
        }

        processedCount += batch.length;
        const progress = 20 + Math.floor((processedCount / filesToScan.length) * 70);
        this.emitProgress(scanId, { 
          status: 'running', 
          progress, 
          message: `LLM analyzed ${processedCount}/${filesToScan.length} files... Found ${allVulnerabilities.length} issues` 
        });
      }

      // 6. Map categories and deduplicate
      const mappedVulnerabilities = allVulnerabilities.map(v => this.mapGeminiVulnerability(v));
      const uniqueVulns = this.deduplicateVulnerabilities(mappedVulnerabilities);
      const sortedVulns = this.sortVulnerabilitiesBySeverity(uniqueVulns);

      // 7. Finalize scan
      scan.status = 'completed';
      scan.completedAt = new Date();
      scan.vulnerabilities = sortedVulns;
      scan.totalVulns = scan.vulnerabilities.length;
      
      scan.criticalCount = scan.vulnerabilities.filter(v => v.severity === 'critical').length;
      scan.highCount = scan.vulnerabilities.filter(v => v.severity === 'high').length;
      scan.mediumCount = scan.vulnerabilities.filter(v => v.severity === 'medium').length;
      scan.lowCount = scan.vulnerabilities.filter(v => v.severity === 'low').length;
      
      this.calculateRiskScore(scan);
      await scan.save();

      this.emitLog(scanId, `✅ Gemini AI scan completed! Found ${scan.totalVulns} vulnerabilities`, 'success');
      this.emitLog(scanId, `📊 Severity: Critical: ${scan.criticalCount}, High: ${scan.highCount}, Medium: ${scan.mediumCount}, Low: ${scan.lowCount}`);
      
      this.emitComplete(scanId, { 
        status: 'completed', 
        totalVulns: scan.totalVulns,
        criticalCount: scan.criticalCount,
        highCount: scan.highCount,
        mediumCount: scan.mediumCount,
        lowCount: scan.lowCount,
        securityScore: scan.securityScore
      });

    } catch (error) {
      console.error('Gemini repository scan error:', error);
      
      try {
        const scan = await Scan.findById(scanId);
        if (scan) {
          scan.status = 'failed';
          scan.completedAt = new Date();
          await scan.save();
        }
      } catch (e) {}
      
      this.emitError(scanId, { message: error.message });
      this.emitLog(scanId, `❌ Scan failed: ${error.message}`, 'error');
    }
  }

  // ====================================================================
  // 🤖 GEMINI FILE ANALYZER
  // ====================================================================

  async analyzeFileWithGemini(filePath, fileContent) {
    const prompt = `You are a world-class security expert analyzing source code for vulnerabilities.

FILE: ${filePath}
LANGUAGE: ${this.detectLanguage(filePath)}

CODE:
\`\`\`
${fileContent}
\`\`\`

TASK: Identify ALL security vulnerabilities, bugs, and bad practices in this code.

IMPORTANT - Use ONLY these exact category values (no emojis, no spaces, no special characters):
- "secret-exposure"
- "code-injection"
- "command-injection"
- "sql-injection"
- "xss"
- "authentication"
- "authorization"
- "broken-access-control"
- "input-validation"
- "pii-exposure"
- "csrf"
- "session-management"
- "deserialization"
- "security-misconfiguration"
- "misconfiguration"
- "information-disclosure"
- "file-security"
- "code-quality"

Return a JSON array of vulnerabilities. Each vulnerability MUST have:
- name: Clear, descriptive title
- severity: "critical", "high", "medium", "low", or "info"
- category: One of the EXACT category strings listed above
- description: Detailed explanation of the issue
- line: Line number (integer, approximate if exact unknown)
- evidence: The exact vulnerable code snippet
- solution: Step-by-step fix instructions

If NO vulnerabilities found, return an empty array [].

Return ONLY valid JSON, no other text.`;

    try {
      const result = await this.model.generateContent(prompt);
      const text = result.response.text().replace(/```json|```/g, '').trim();
      
      let vulnerabilities = [];
      try {
        vulnerabilities = JSON.parse(text);
      } catch (e) {
        console.error('Failed to parse Gemini response:', e);
        return [];
      }

      if (!Array.isArray(vulnerabilities)) {
        return [];
      }

      return vulnerabilities.map(v => ({
        ...v,
        file: filePath,
        evidence: v.evidence || fileContent.split('\n')[v.line - 1]?.trim() || 'Code snippet not available',
        detectedBy: 'gemini-ai',
        confidence: 'high',
        category: this.mapGeminiCategory(v.category || 'code-quality')
      }));

    } catch (error) {
      console.error('Gemini analysis error:', error);
      return [];
    }
  }

  // ====================================================================
  // 🗺️ CATEGORY MAPPING
  // ====================================================================

  mapGeminiCategory(category) {
    if (!category) return 'code-quality';
    
    const categoryStr = category.toString().toLowerCase().trim();
    const cleanCategory = categoryStr.replace(/[^\w\s-]/g, '').trim();
    
    const categoryMap = {
      'secret': 'secret-exposure',
      'secrets': 'secret-exposure',
      'credentials': 'secret-exposure',
      'api key': 'secret-exposure',
      'password': 'secret-exposure',
      'token': 'secret-exposure',
      'private key': 'secret-exposure',
      'injection': 'code-injection',
      'code injection': 'code-injection',
      'command injection': 'command-injection',
      'sql injection': 'sql-injection',
      'xss': 'xss',
      'cross site scripting': 'xss',
      'eval': 'code-injection',
      'auth': 'authentication',
      'authentication': 'authentication',
      'login': 'authentication',
      'password reset': 'authentication',
      'rate limit': 'authentication',
      'authorization': 'authorization',
      'access control': 'broken-access-control',
      'idor': 'broken-access-control',
      'privilege escalation': 'broken-access-control',
      'input': 'input-validation',
      'validation': 'input-validation',
      'phone': 'input-validation',
      'email': 'input-validation',
      'pii': 'pii-exposure',
      'ssn': 'pii-exposure',
      'credit card': 'pci-compliance',
      'pci': 'pci-compliance',
      'csrf': 'csrf',
      'cross site request forgery': 'csrf',
      'session': 'session-management',
      'deserialization': 'deserialization',
      'pickle': 'deserialization',
      'config': 'misconfiguration',
      'configuration': 'misconfiguration',
      'cors': 'misconfiguration',
      'debug': 'misconfiguration',
      'environment': 'misconfiguration',
      'file': 'file-security',
      'upload': 'file-security',
      'path traversal': 'file-security',
      'disclosure': 'information-disclosure',
      'information': 'information-disclosure',
      'stack trace': 'information-disclosure',
      'quality': 'code-quality',
      'code quality': 'code-quality',
      'dependency': 'code-quality',
      'outdated': 'code-quality',
      'todo': 'code-quality',
      'comment': 'code-quality'
    };

    if (categoryMap[cleanCategory]) {
      return categoryMap[cleanCategory];
    }

    for (const [key, value] of Object.entries(categoryMap)) {
      if (cleanCategory.includes(key)) {
        return value;
      }
    }

    return 'code-quality';
  }

  mapGeminiVulnerability(vuln) {
    return {
      name: vuln.name || 'Unknown Vulnerability',
      severity: vuln.severity || 'medium',
      category: this.mapGeminiCategory(vuln.category),
      description: vuln.description || 'No description provided',
      file: vuln.file,
      line: vuln.line ? parseInt(vuln.line) : 0,
      evidence: vuln.evidence || 'No evidence provided',
      solution: vuln.solution || 'No solution provided',
      detectedBy: 'gemini-ai',
      confidence: vuln.confidence || 'high'
    };
  }

  // ====================================================================
  // 🛠️ HELPER METHODS
  // ====================================================================

  detectLanguage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const langMap = {
      '.js': 'JavaScript',
      '.jsx': 'React JSX',
      '.ts': 'TypeScript',
      '.tsx': 'React TypeScript',
      '.py': 'Python',
      '.java': 'Java',
      '.go': 'Golang',
      '.rb': 'Ruby',
      '.php': 'PHP',
      '.cs': 'C#',
      '.kt': 'Kotlin',
      '.swift': 'Swift',
      '.dart': 'Dart',
      '.html': 'HTML',
      '.css': 'CSS',
      '.scss': 'SCSS',
      '.vue': 'Vue.js',
      '.json': 'JSON',
      '.yml': 'YAML',
      '.yaml': 'YAML',
      '.xml': 'XML',
      '.env': 'Environment Variables'
    };
    return langMap[ext] || 'Unknown';
  }

  deduplicateVulnerabilities(vulnerabilities) {
    const uniqueMap = new Map();
    
    vulnerabilities.forEach(v => {
      const key = `${v.name}|${v.file}|${v.line}|${v.evidence?.substring(0, 50)}`;
      
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, v);
      } else {
        const existing = uniqueMap.get(key);
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
        if (severityOrder[v.severity] > severityOrder[existing.severity]) {
          uniqueMap.set(key, v);
        }
      }
    });
    
    return Array.from(uniqueMap.values());
  }

  sortVulnerabilitiesBySeverity(vulnerabilities) {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return [...vulnerabilities].sort((a, b) => {
      const severityDiff = (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99);
      if (severityDiff !== 0) return severityDiff;
      return (a.name || '').localeCompare(b.name || '');
    });
  }

  isValidUrl(url) {
    try { 
      new URL(url); 
      return true; 
    } catch { 
      return false; 
    }
  }

  async checkRateLimit(userId) {
    const user = await User.findById(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const scansToday = await Scan.countDocuments({ userId, createdAt: { $gte: today } });
    return scansToday < (user?.permissions?.maxScansPerDay || 50);
  }

  calculateRiskScore(scan) {
    let score = 100;
    score -= (scan.vulnerabilities.filter(v => v.severity === 'critical').length * 15);
    score -= (scan.vulnerabilities.filter(v => v.severity === 'high').length * 8);
    score -= (scan.vulnerabilities.filter(v => v.severity === 'medium').length * 4);
    score -= (scan.vulnerabilities.filter(v => v.severity === 'low').length * 1);
    scan.securityScore = Math.max(0, Math.min(100, score));
  }

  // --- Socket Emitters ---
  emitProgress(scanId, data) { 
    if (global.io) {
      global.io.to(`scan_${scanId}`).emit('scan_progress', data);
    }
  }
  
  emitLog(scanId, msg, type = 'log') { 
    if (global.io) {
      global.io.to(`scan_${scanId}`).emit('scan_log', { 
        message: msg, 
        type: type,
        timestamp: new Date()
      });
    }
    // Also log to console for debugging
    console.log(`[Scan ${scanId}] ${msg}`);
  }
  
  emitComplete(scanId, data) { 
    if (global.io) {
      global.io.to(`scan_${scanId}`).emit('scan_complete', data);
    }
  }
  
  emitError(scanId, err) { 
    if (global.io) {
      global.io.to(`scan_${scanId}`).emit('scan_error', err);
    }
  }
}

module.exports = new ScanController();