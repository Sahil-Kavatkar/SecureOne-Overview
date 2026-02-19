// // src/controllers/authController.js

// const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken');
// const { Octokit } = require('@octokit/rest');
// const User = require('../models/User');

// class AuthController {
  
//   // FIX: Converted to Arrow Function to preserve 'this' context
//   register = async (req, res, next) => {
//     try {
//       const { email, username, password } = req.body;

//       const existingUser = await User.findOne({ email });
//       if (existingUser) {
//         return res.status(400).json({
//           success: false,
//           message: 'User already exists with this email'
//         });
//       }

//       const salt = await bcrypt.genSalt(10);
//       const passwordHash = await bcrypt.hash(password, salt);

//       const user = await User.create({
//         email,
//         username,
//         passwordHash,
//         role: 'user',
//         permissions: {
//           maxScansPerDay: 50,
//           canUseAI: true,
//           canAutoPR: true,
//           canAccessPrivateRepos: false
//         }
//       });

//       // Now 'this' refers to the AuthController instance correctly
//       const token = this.generateToken(user._id);

//       console.log(`✅ New user registered: ${email}`);

//       res.status(201).json({
//         success: true,
//         message: 'User registered successfully',
//         data: {
//           user: {
//             id: user._id,
//             email: user.email,
//             username: user.username,
//             role: user.role
//           },
//           token
//         }
//       });
//     } catch (error) {
//       console.error('Registration error:', error);
//       next(error);
//     }
//   }

//   // FIX: Converted to Arrow Function
//   login = async (req, res, next) => {
//     try {
//       const { email, password } = req.body;

//       const user = await User.findOne({ email }).select('+passwordHash');
//       if (!user) {
//         return res.status(401).json({
//           success: false,
//           message: 'Invalid credentials'
//         });
//       }

//       const isMatch = await bcrypt.compare(password, user.passwordHash);
//       if (!isMatch) {
//         return res.status(401).json({
//           success: false,
//           message: 'Invalid credentials'
//         });
//       }

//       user.lastLogin = new Date();
//       await user.save();

//       const token = this.generateToken(user._id);

//       console.log(`✅ User logged in: ${email}`);

//       res.json({
//         success: true,
//         message: 'Login successful',
//         data: {
//           user: {
//             id: user._id,
//             email: user.email,
//             username: user.username,
//             role: user.role,
//             githubConnected: !!user.githubId
//           },
//           token
//         }
//       });
//     } catch (error) {
//       console.error('Login error:', error);
//       next(error);
//     }
//   }

//   // FIX: Converted to Arrow Function
//   getMe = async (req, res, next) => {
//     try {
//       const user = await User.findById(req.user.id);
      
//       res.json({
//         success: true,
//         data: {
//           user: {
//             id: user._id,
//             email: user.email,
//             username: user.username,
//             role: user.role,
//             permissions: user.permissions,
//             githubConnected: !!user.githubId,
//             githubUsername: user.githubUsername,
//             createdAt: user.createdAt
//           }
//         }
//       });
//     } catch (error) {
//       console.error('Get me error:', error);
//       next(error);
//     }
//   }

//   // FIX: Converted to Arrow Function
//   githubAuth = async (req, res) => {
//     const clientId = process.env.GITHUB_CLIENT_ID;
//     const redirectUri = encodeURIComponent(process.env.GITHUB_CALLBACK_URL);
//     const scope = 'repo,user,read:org';

//     const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`;

//     console.log('🔐 GitHub Auth URL:', githubAuthUrl);
//     console.log('📍 Redirect URI:', process.env.GITHUB_CALLBACK_URL);

//     res.redirect(githubAuthUrl);
//   }

//   // FIX: Converted to Arrow Function
//   githubCallback = async (req, res, next) => {
//     try {
//       const { code } = req.query;

//       if (!code) {
//         return res.status(400).json({
//           success: false,
//           message: 'No authorization code provided'
//         });
//       }

//       // Exchange code for access token
//       const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'Accept': 'application/json'
//         },
//         body: JSON.stringify({
//           client_id: process.env.GITHUB_CLIENT_ID,
//           client_secret: process.env.GITHUB_CLIENT_SECRET,
//           code
//         })
//       });

//       const tokenData = await tokenResponse.json();

//       if (tokenData.error) {
//         throw new Error(tokenData.error_description);
//       }

//       const accessToken = tokenData.access_token;

//       // Get GitHub user info
//       const octokit = new Octokit({ auth: accessToken });
//       const { data: githubUser } = await octokit.users.getAuthenticated();

//       // Find or create user
//       let user = await User.findOne({ githubId: githubUser.id });

//       if (user) {
//         user.githubAccessToken = this.encryptToken(accessToken);
//         user.githubUsername = githubUser.login;
//         user.githubAvatar = githubUser.avatar_url;
//         user.lastLogin = new Date();
//         await user.save();
//       } else {
//         user = await User.findOne({ email: githubUser.email });

//         if (user) {
//           user.githubId = githubUser.id;
//           user.githubAccessToken = this.encryptToken(accessToken);
//           user.githubUsername = githubUser.login;
//           user.githubAvatar = githubUser.avatar_url;
//           user.permissions.canAccessPrivateRepos = true;
//           await user.save();
//         } else {
//           user = await User.create({
//             email: githubUser.email || `${githubUser.login}@github.user`,
//             username: githubUser.login,
//             githubId: githubUser.id,
//             githubAccessToken: this.encryptToken(accessToken),
//             githubUsername: githubUser.login,
//             githubAvatar: githubUser.avatar_url,
//             role: 'user',
//             permissions: {
//               maxScansPerDay: 50,
//               canUseAI: true,
//               canAutoPR: true,
//               canAccessPrivateRepos: true
//             },
//             isEmailVerified: true
//           });
//         }
//       }

//       // 'this' works here too now
//       const token = this.generateToken(user._id);

//       console.log(`✅ GitHub OAuth successful: ${githubUser.login}`);

//       res.json({
//         success: true,
//         message: 'GitHub OAuth successful',
//         data: {
//           user: {
//             id: user._id,
//             email: user.email,
//             username: user.username,
//             role: user.role,
//             githubId: user.githubId,
//             githubUsername: user.githubUsername,
//             githubConnected: true
//           },
//           token
//         }
//       });
//     } catch (error) {
//       console.error('GitHub OAuth error:', error);
//       res.status(400).json({
//         success: false,
//         message: error.message || 'GitHub authentication failed'
//       });
//     }
//   }

//   // FIX: Converted to Arrow Function
//   disconnectGithub = async (req, res, next) => {
//     try {
//       const user = await User.findById(req.user.id);

//       user.githubId = null;
//       user.githubAccessToken = null;
//       user.githubUsername = null;
//       user.githubAvatar = null;
//       user.permissions.canAccessPrivateRepos = false;
//       await user.save();

//       console.log(`✅ GitHub disconnected: ${user.email}`);

//       res.json({
//         success: true,
//         message: 'GitHub account disconnected successfully'
//       });
//     } catch (error) {
//       console.error('Disconnect GitHub error:', error);
//       next(error);
//     }
//   }

//   // FIX: Converted to Arrow Function
//   logout = async (req, res) => {
//     console.log(`✅ User logged out: ${req.user.email}`);

//     res.json({
//       success: true,
//       message: 'Logged out successfully'
//     });
//   }

//   // Helpers can remain as standard methods (they are called internally)
//   generateToken(userId) {
//     return jwt.sign(
//       { id: userId },
//       process.env.JWT_SECRET,
//       { expiresIn: process.env.JWT_EXPIRE || '7d' }
//     );
//   }

//   encryptToken(token) {
//     return Buffer.from(token).toString('base64');
//   }

//   decryptToken(encrypted) {
//     return Buffer.from(encrypted, 'base64').toString('utf-8');
//   }
// }

// module.exports = new AuthController();

















// src/controllers/authController.js

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Octokit } = require('@octokit/rest');
const User = require('../models/User');

class AuthController {
  
  // =================================================================
  // AUTHENTICATION METHODS
  // =================================================================

  register = async (req, res, next) => {
    try {
      const { email, username, password } = req.body;

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'User already exists' });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const user = await User.create({
        email,
        username,
        passwordHash,
        role: 'user',
        permissions: { maxScansPerDay: 50, canUseAI: true, canAutoPR: true, canAccessPrivateRepos: false }
      });

      const token = this.generateToken(user._id);

      console.log(`✅ New user registered: ${email}`);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: { user: this.sanitizeUser(user), token }
      });
    } catch (error) {
      console.error('Registration error:', error);
      next(error);
    }
  }

  login = async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email }).select('+passwordHash');
      
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      user.lastLogin = new Date();
      await user.save();
      const token = this.generateToken(user._id);

      console.log(`✅ User logged in: ${email}`);

      res.json({
        success: true,
        message: 'Login successful',
        data: { user: this.sanitizeUser(user), token }
      });
    } catch (error) {
      console.error('Login error:', error);
      next(error);
    }
  }

  getMe = async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id);
      res.json({ success: true, data: { user: this.sanitizeUser(user) } });
    } catch (error) {
      console.error('Get me error:', error);
      next(error);
    }
  }

  // =================================================================
  // GITHUB OAUTH - FIXED FOR NGROK AND DUPLICATE HANDLING
  // =================================================================

  /**
   * Returns the backend URL for GitHub OAuth
   * GitHub redirects to backend (ngrok), backend then redirects to frontend (localhost)
   */
  getGitHubRedirectUri() {
    const backendUrl = process.env.BACKEND_URL || 'https://tegminal-unideaed-crystle.ngrok-free.dev';
    return `${backendUrl}/api/v1/auth/github/callback`;
  }

  githubAuth = async (req, res) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = encodeURIComponent(this.getGitHubRedirectUri());
    const scope = 'repo,user,read:org';

    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`;
    
    console.log(`🔐 Initiating GitHub Auth.`);
    console.log(`📍 Redirect URI (backend): ${this.getGitHubRedirectUri()}`);
    console.log(`🔗 Frontend will receive token at: ${process.env.FRONTEND_URL}/auth/github/callback`);
    
    res.redirect(githubAuthUrl);
  }

  githubCallback = async (req, res, next) => {
    try {
      const { code } = req.query;
      if (!code) {
        return res.redirect(`${process.env.FRONTEND_URL}/auth/github/callback?error=No code provided`);
      }

      console.log('🔄 Exchanging code for token...');
      
      const redirectUri = this.getGitHubRedirectUri();

      // Exchange code for token
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: redirectUri 
        })
      });

      const tokenData = await tokenResponse.json();
      if (tokenData.error) {
        throw new Error(tokenData.error_description || 'GitHub Token Exchange Failed');
      }

      const accessToken = tokenData.access_token;
      const octokit = new Octokit({ auth: accessToken });
      const { data: githubUser } = await octokit.users.getAuthenticated();

      console.log(`👤 GitHub User Authenticated: ${githubUser.login}`);
      console.log(`📧 GitHub Email: ${githubUser.email || 'No public email'}`);

      // ✅ FIXED: Better user lookup with multiple strategies
      let user = null;
      
      // Strategy 1: Find by GitHub ID (most reliable)
      user = await User.findOne({ githubId: githubUser.id });
      
      // Strategy 2: If not found, try by email (if available)
      if (!user && githubUser.email) {
        user = await User.findOne({ email: githubUser.email });
        if (user) {
          console.log(`✅ Found existing user by email: ${user.email}`);
          // Link GitHub to existing account
          user.githubId = githubUser.id;
          user.githubUsername = githubUser.login;
          user.githubAvatar = githubUser.avatar_url;
          user.permissions.canAccessPrivateRepos = true;
        }
      }
      
      // Strategy 3: Try by username as fallback
      if (!user) {
        user = await User.findOne({ username: githubUser.login });
        if (user) {
          console.log(`✅ Found existing user by username: ${user.username}`);
          // Link GitHub to existing account
          user.githubId = githubUser.id;
          user.githubEmail = githubUser.email || user.email;
          user.githubUsername = githubUser.login;
          user.githubAvatar = githubUser.avatar_url;
          user.permissions.canAccessPrivateRepos = true;
        }
      }

      if (user) {
        // Update existing user with latest GitHub info
        user.githubAccessToken = this.encryptToken(accessToken);
        user.githubUsername = githubUser.login;
        user.githubAvatar = githubUser.avatar_url;
        user.lastLogin = new Date();
        await user.save();
        console.log(`✅ Updated existing user: ${user.email}`);
      } else {
        // Create new user
        const email = githubUser.email || `${githubUser.login}@github.user`;
        
        // Check if email already exists one more time (race condition)
        const existingEmail = await User.findOne({ email });
        if (existingEmail) {
          // If email exists but we didn't find by GitHub ID, link it
          existingEmail.githubId = githubUser.id;
          existingEmail.githubAccessToken = this.encryptToken(accessToken);
          existingEmail.githubUsername = githubUser.login;
          existingEmail.githubAvatar = githubUser.avatar_url;
          existingEmail.permissions.canAccessPrivateRepos = true;
          existingEmail.lastLogin = new Date();
          await existingEmail.save();
          user = existingEmail;
          console.log(`✅ Linked GitHub to existing email user: ${user.email}`);
        } else {
          // Create brand new user
          user = await User.create({
            email: email,
            username: githubUser.login,
            githubId: githubUser.id,
            githubAccessToken: this.encryptToken(accessToken),
            githubUsername: githubUser.login,
            githubAvatar: githubUser.avatar_url,
            role: 'user',
            permissions: { 
              maxScansPerDay: 50, 
              canUseAI: true, 
              canAutoPR: true, 
              canAccessPrivateRepos: true 
            },
            isEmailVerified: true,
            lastLogin: new Date()
          });
          console.log(`✅ Created new user from GitHub: ${user.email}`);
        }
      }

      // Generate JWT token
      const token = this.generateToken(user._id);
      
      // Redirect to FRONTEND (localhost) with token
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/auth/github/callback?token=${token}`);

    } catch (error) {
      console.error('❌ GitHub Callback Error:', error);
      
      // Check for duplicate key error specifically
      if (error.code === 11000) {
        console.log('⚠️ Duplicate key error - attempting to find and update existing user');
        
        try {
          // Try to extract email from error
          const email = error.keyValue?.email;
          if (email) {
            const existingUser = await User.findOne({ email });
            if (existingUser) {
              // Generate token for existing user
              const token = this.generateToken(existingUser._id);
              const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
              return res.redirect(`${frontendUrl}/auth/github/callback?token=${token}`);
            }
          }
        } catch (e) {
          console.error('Failed to recover from duplicate key error:', e);
        }
      }
      
      // Redirect to frontend with error
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/auth/github/callback?error=${encodeURIComponent(error.message)}`);
    }
  }

  disconnectGithub = async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id);
      
      user.githubId = null;
      user.githubAccessToken = null;
      user.githubUsername = null;
      user.githubAvatar = null;
      user.permissions.canAccessPrivateRepos = false;
      await user.save();
      
      console.log(`✅ GitHub disconnected: ${user.email}`);
      res.json({ success: true, message: 'GitHub disconnected successfully' });
    } catch (error) { 
      console.error('Disconnect GitHub error:', error);
      next(error); 
    }
  }

  logout = async (req, res) => {
    console.log(`✅ User logged out: ${req.user.email}`);
    res.json({ success: true, message: 'Logged out successfully' });
  }

  // =================================================================
  // HELPERS
  // =================================================================

  sanitizeUser(user) {
    return {
      id: user._id,
      email: user.email,
      username: user.username,
      role: user.role,
      githubConnected: !!user.githubId,
      githubUsername: user.githubUsername,
      githubId: user.githubId,
      githubAvatar: user.githubAvatar,
      permissions: user.permissions,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    };
  }

  generateToken(userId) {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
  }

  encryptToken(token) {
    return Buffer.from(token).toString('base64');
  }

  decryptToken(encrypted) {
    if (!encrypted) return null;
    try {
      return Buffer.from(encrypted, 'base64').toString('utf-8');
    } catch (e) {
      console.error('Token decryption failed:', e);
      return null;
    }
  }
}

module.exports = new AuthController();