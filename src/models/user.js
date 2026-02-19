// src/models/User.js

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  
  username: {
    type: String,
    required: [true, 'Username is required'],
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters']
  },
  
  passwordHash: {
    type: String,
    select: false
  },
  
  // GitHub Integration
  githubId: {
    type: String,
    unique: true,
    sparse: true
  },
  
  githubAccessToken: {
    type: String,
    select: false
  },
  
  githubUsername: String,
  
  githubAvatar: String,
  
  // Role & Permissions
  role: {
    type: String,
    enum: ['guest', 'user', 'premium', 'admin'],
    default: 'user'
  },
  
  permissions: {
    maxScansPerDay: {
      type: Number,
      default: 50
    },
    canUseAI: {
      type: Boolean,
      default: true
    },
    canAutoPR: {
      type: Boolean,
      default: true
    },
    canAccessPrivateRepos: {
      type: Boolean,
      default: false
    }
  },
  
  // Metadata
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  
  lastLogin: {
    type: Date,
    default: Date.now
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ githubId: 1 });

// Virtual for total scans
userSchema.virtual('totalScans', {
  ref: 'Scan',
  localField: '_id',
  foreignField: 'userId',
  count: true
});

// Methods
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.passwordHash;
  delete user.githubAccessToken;
  delete user.__v;
  return user;
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);