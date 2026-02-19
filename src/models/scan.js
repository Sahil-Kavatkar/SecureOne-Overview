// // src/models/Scan.js

// const mongoose = require('mongoose');

// const vulnerabilitySchema = new mongoose.Schema({
//   severity: {
//     type: String,
//     enum: ['critical', 'high', 'medium', 'low', 'info'],
//     required: true
//   },
  
//   category: {
//     type: String,
//     enum: [
//       'owasp', 'broken', 'ui', 'manifest', 'code', 'permissions', 'network', 'binary',
//       'secret-exposure', 'code-injection', 'command-injection', 'sql-injection', 'xss',
//       'authentication', 'authorization', 'broken-access-control', 'broken-auth',
//       'input-validation', 'pii-exposure', 'pii', 'pci-compliance',
//       'csrf', 'session-management', 'deserialization',
//       'security-misconfiguration', 'misconfiguration', 'configuration',
//       'information-disclosure', 'file-security', 'code-quality'
//     ],
//     required: true
//   },
  
//   cweid: String,
  
//   name: {
//     type: String,
//     required: true
//   },
  
//   description: String,
  
//   evidence: String,
  
//   solution: String,
  
//   reference: String,
  
//   // Location details
//   url: String,
//   method: String,
//   param: String,
//   attack: String,
//   file: String,
//   line: String,
  
//   // AI Remediation
//   aiExplanation: String,
//   aiFixedCode: String,
//   aiBestPractices: [String],
//   aiGeneratedAt: Date,
//   aiFixApplied: {
//     type: Boolean,
//     default: false
//   },
  
//   // PR Information
//   prUrl: String,
//   prNumber: Number,
//   prBranch: String,
//   prCreatedAt: Date,
  
//   // Gemini Specific
//   detectedBy: {
//     type: String,
//     enum: ['zap', 'mobsf', 'gemini-ai', 'regex'],
//     default: 'gemini-ai'
//   },
  
//   confidence: {
//     type: String,
//     enum: ['high', 'medium', 'low'],
//     default: 'high'
//   }
// }, { 
//   _id: true,
//   strict: false
// });

// const scanSchema = new mongoose.Schema({
//   userId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: false,
//     index: true
//   },
  
//   scanType: {
//     type: String,
//     enum: ['web', 'mobile', 'repository', 'link', 'phone'],
//     required: true,
//     index: true
//   },
  
//   repositoryScanType: {
//     type: String,
//     enum: ['frontend', 'backend', 'fullstack', 'mobile'],
//     default: 'fullstack'
//   },
  
//   target: {
//     type: {
//       type: String,
//       enum: ['url', 'repositoryUrl', 'apkUrl', 'phoneNumber']
//     },
//     url: String,
//     repositoryUrl: String,
//     branch: {
//       type: String,
//       default: 'main'
//     },
//     apkUrl: String,
//     phoneNumber: String
//   },
  
//   status: {
//     type: String,
//     enum: ['queued', 'running', 'completed', 'failed', 'cancelled'],
//     default: 'queued',
//     index: true
//   },

//   originalCode: {
//   type: String,
//   select: false // Don't send by default to save bandwidth
// },
  
//   progress: {
//     type: Number,
//     min: 0,
//     max: 100,
//     default: 0
//   },
  
//   startedAt: Date,
//   completedAt: Date,
  
//   vulnerabilities: [vulnerabilitySchema],
  
//   rawReport: {
//     type: mongoose.Schema.Types.Mixed,
//     select: false
//   },
  
//   scanDuration: Number,
  
//   totalVulns: {
//     type: Number,
//     default: 0
//   },
  
//   criticalCount: { type: Number, default: 0 },
//   highCount: { type: Number, default: 0 },
//   mediumCount: { type: Number, default: 0 },
//   lowCount: { type: Number, default: 0 },
  
//   appInfo: {
//     appName: String,
//     packageName: String,
//     version: String,
//     minSdk: String,
//     targetSdk: String
//   },
  
//   securityScore: {
//     type: Number,
//     min: 0,
//     max: 100,
//     default: 0
//   },
  
//   aiSummary: String,
//   aiSummaryGeneratedAt: Date,
  
//   config: {
//     depth: {
//       type: String,
//       enum: ['fast', 'medium', 'deep'],
//       default: 'medium'
//     }
//   }
// }, {
//   timestamps: true,
//   strict: false
// });

// // Indexes
// scanSchema.index({ userId: 1, createdAt: -1 });
// scanSchema.index({ scanType: 1, status: 1 });
// scanSchema.index({ 'target.repositoryUrl': 1 });

// // Virtuals
// scanSchema.virtual('isCompleted').get(function() {
//   return this.status === 'completed';
// });

// scanSchema.virtual('hasVulnerabilities').get(function() {
//   return this.totalVulns > 0;
// });

// scanSchema.virtual('durationMinutes').get(function() {
//   if (!this.startedAt || !this.completedAt) return null;
//   return Math.round((this.completedAt - this.startedAt) / 1000 / 60 * 10) / 10;
// });

// // Methods
// scanSchema.methods.toJSON = function() {
//   const scan = this.toObject({ virtuals: true });
//   delete scan.__v;
//   delete scan.rawReport;
//   return scan;
// };

// // Statics
// scanSchema.statics.getUserScanStats = async function(userId) {
//   return this.aggregate([
//     { $match: { userId: new mongoose.Types.ObjectId(userId) } },
//     {
//       $group: {
//         _id: null,
//         totalScans: { $sum: 1 },
//         completedScans: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
//         totalVulns: { $sum: '$totalVulns' },
//         criticalVulns: { $sum: '$criticalCount' },
//         highVulns: { $sum: '$highCount' }
//       }
//     }
//   ]);
// };

// module.exports = mongoose.model('Scan', scanSchema);

















// src/models/Scan.js

const mongoose = require('mongoose');

const vulnerabilitySchema = new mongoose.Schema({
  severity: {
    type: String,
    enum: ['critical', 'high', 'medium', 'low', 'info'],
    required: true
  },
  
  category: {
    type: String,
    enum: [
      'owasp', 'broken', 'ui', 'manifest', 'code', 'permissions', 'network', 'binary',
      'secret-exposure', 'code-injection', 'command-injection', 'sql-injection', 'xss',
      'authentication', 'authorization', 'broken-access-control', 'broken-auth',
      'input-validation', 'pii-exposure', 'pii', 'pci-compliance',
      'csrf', 'session-management', 'deserialization',
      'security-misconfiguration', 'misconfiguration', 'configuration',
      'information-disclosure', 'file-security', 'code-quality'
    ],
    required: true
  },
  
  cweid: String,
  
  name: {
    type: String,
    required: true
  },
  
  description: String,
  
  evidence: String,
  
  solution: String,
  
  reference: String,
  
  // Location details
  url: String,
  method: String,
  param: String,
  attack: String,
  file: String,
  line: String,
  
  // ✅ NEW: Store original vulnerable code for patching
  originalCode: {
    type: String,
    select: false // Don't send by default to save bandwidth
  },
  
  // AI Remediation
  aiExplanation: String,
  aiFixedCode: String,
  aiBestPractices: [String],
  aiGeneratedAt: Date,
  aiFixApplied: {
    type: Boolean,
    default: false
  },
  
  // PR Information
  prUrl: String,
  prNumber: Number,
  prBranch: String,
  prCreatedAt: Date,
  
  // Gemini Specific
  detectedBy: {
    type: String,
    enum: ['zap', 'mobsf', 'gemini-ai', 'regex'],
    default: 'gemini-ai'
  },
  
  confidence: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'high'
  }
}, { 
  _id: true,
  strict: false
});

const scanSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true
  },
  
  scanType: {
    type: String,
    enum: ['web', 'mobile', 'repository', 'link', 'phone'],
    required: true,
    index: true
  },
  
  repositoryScanType: {
    type: String,
    enum: ['frontend', 'backend', 'fullstack', 'mobile'],
    default: 'fullstack'
  },
  
  target: {
    type: {
      type: String,
      enum: ['url', 'repositoryUrl', 'apkUrl', 'phoneNumber']
    },
    url: String,
    repositoryUrl: String,
    branch: {
      type: String,
      default: 'main'
    },
    apkUrl: String,
    phoneNumber: String
  },
  
  status: {
    type: String,
    enum: ['queued', 'running', 'completed', 'failed', 'cancelled'],
    default: 'queued',
    index: true
  },
  
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  
  startedAt: Date,
  completedAt: Date,
  
  vulnerabilities: [vulnerabilitySchema],
  
  rawReport: {
    type: mongoose.Schema.Types.Mixed,
    select: false
  },
  
  scanDuration: Number,
  
  totalVulns: {
    type: Number,
    default: 0
  },
  
  criticalCount: { type: Number, default: 0 },
  highCount: { type: Number, default: 0 },
  mediumCount: { type: Number, default: 0 },
  lowCount: { type: Number, default: 0 },
  
  appInfo: {
    appName: String,
    packageName: String,
    version: String,
    minSdk: String,
    targetSdk: String
  },
  
  securityScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  
  aiSummary: String,
  aiSummaryGeneratedAt: Date,
  
  config: {
    depth: {
      type: String,
      enum: ['fast', 'medium', 'deep'],
      default: 'medium'
    }
  }
}, {
  timestamps: true,
  strict: false
});

// Indexes
scanSchema.index({ userId: 1, createdAt: -1 });
scanSchema.index({ scanType: 1, status: 1 });
scanSchema.index({ 'target.repositoryUrl': 1 });

// Virtuals
scanSchema.virtual('isCompleted').get(function() {
  return this.status === 'completed';
});

scanSchema.virtual('hasVulnerabilities').get(function() {
  return this.totalVulns > 0;
});

scanSchema.virtual('durationMinutes').get(function() {
  if (!this.startedAt || !this.completedAt) return null;
  return Math.round((this.completedAt - this.startedAt) / 1000 / 60 * 10) / 10;
});

// Methods
scanSchema.methods.toJSON = function() {
  const scan = this.toObject({ virtuals: true });
  delete scan.__v;
  delete scan.rawReport;
  return scan;
};

// Statics
scanSchema.statics.getUserScanStats = async function(userId) {
  return this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalScans: { $sum: 1 },
        completedScans: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        totalVulns: { $sum: '$totalVulns' },
        criticalVulns: { $sum: '$criticalCount' },
        highVulns: { $sum: '$highCount' }
      }
    }
  ]);
};

// Pre-save middleware to calculate totals
scanSchema.pre('save', function(next) {
  if (this.vulnerabilities && this.vulnerabilities.length > 0) {
    this.totalVulns = this.vulnerabilities.length;
    this.criticalCount = this.vulnerabilities.filter(v => v.severity === 'critical').length;
    this.highCount = this.vulnerabilities.filter(v => v.severity === 'high').length;
    this.mediumCount = this.vulnerabilities.filter(v => v.severity === 'medium').length;
    this.lowCount = this.vulnerabilities.filter(v => v.severity === 'low').length;
  }
  next();
});

// Pre-save middleware to calculate duration
scanSchema.pre('save', function(next) {
  if (this.isModified('completedAt') && this.startedAt && this.completedAt) {
    this.scanDuration = (this.completedAt - this.startedAt) / 1000;
  }
  next();
});

module.exports = mongoose.model('Scan', scanSchema);