
// scripts/fix-scan-categories.js

const mongoose = require('mongoose');
const Scan = require('../models/Scan');
require('dotenv').config();

const fixScanCategories = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('📦 Connected to MongoDB');

    const validCategories = [
      'owasp', 'broken', 'ui', 'manifest', 'code', 'permissions', 'network', 'binary',
      'secret-exposure', 'code-injection', 'command-injection', 'sql-injection', 'xss',
      'authentication', 'authorization', 'broken-access-control', 'broken-auth',
      'input-validation', 'pii-exposure', 'pii', 'pci-compliance',
      'csrf', 'session-management', 'deserialization',
      'security-misconfiguration', 'misconfiguration', 'configuration',
      'information-disclosure', 'file-security', 'code-quality'
    ];

    const scans = await Scan.find({ 'vulnerabilities.category': { $nin: validCategories } });
    
    for (const scan of scans) {
      let modified = false;
      
      scan.vulnerabilities.forEach(vuln => {
        if (!validCategories.includes(vuln.category)) {
          console.log(`🔄 Fixing: ${vuln.category} -> code-quality`);
          vuln.category = 'code-quality';
          modified = true;
        }
      });
      
      if (modified) {
        await scan.save();
        console.log(`✅ Updated scan: ${scan._id}`);
      }
    }

    console.log('✨ All scans fixed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

fixScanCategories();