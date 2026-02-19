




// src/utils/vulnMapper.js - Enhanced Auto-Mapping Logic

/**
 * Auto-map vulnerabilities to repository files
 * @param {Array} vulnerabilities - List of vulnerabilities from scan
 * @param {Array} repoFiles - List of files from GitHub repository
 * @returns {Object} - Mapping of vulnerability IDs to matched files
 */
export const autoMapVulnerabilities = (vulnerabilities, repoFiles) => {
  const mappings = {};

  vulnerabilities.forEach(vuln => {
    const vulnId = vuln._id || vuln.name;
    
    // Try different matching strategies
    const matchedFile = 
      matchByExactPath(vuln, repoFiles) ||
      matchByFilename(vuln, repoFiles) ||
      matchByUrl(vuln, repoFiles) ||
      matchByParam(vuln, repoFiles) ||
      matchByPattern(vuln, repoFiles);

    if (matchedFile) {
      mappings[vulnId] = {
        file: matchedFile,
        confidence: calculateConfidence(vuln, matchedFile)
      };
    }
  });

  return mappings;
};

/**
 * Strategy 1: Match by exact file path
 */
const matchByExactPath = (vuln, repoFiles) => {
  if (!vuln.file) return null;
  
  // Clean up the file path
  const cleanPath = vuln.file
    .replace(/^\/+/, '') // Remove leading slashes
    .replace(/\\/g, '/'); // Normalize slashes
  
  return repoFiles.find(file => 
    file.path === cleanPath ||
    file.path.endsWith(cleanPath)
  );
};

/**
 * Strategy 2: Match by filename only
 */
const matchByFilename = (vuln, repoFiles) => {
  if (!vuln.file) return null;
  
  const filename = vuln.file.split('/').pop();
  
  // Find all files with matching name
  const matches = repoFiles.filter(file => 
    file.path.endsWith(filename)
  );
  
  // If multiple matches, prefer files in common directories
  if (matches.length > 1) {
    const priority = ['src/', 'app/', 'lib/', 'components/', 'controllers/'];
    for (const dir of priority) {
      const priorityMatch = matches.find(m => m.path.includes(dir));
      if (priorityMatch) return priorityMatch;
    }
  }
  
  return matches[0];
};

/**
 * Strategy 3: Match by URL path (for web scans)
 */
const matchByUrl = (vuln, repoFiles) => {
  if (!vuln.url) return null;
  
  try {
    const url = new URL(vuln.url);
    const pathname = url.pathname;
    
    // Extract potential route/file info from URL
    // e.g., /api/users/:id -> api/users
    const routeParts = pathname
      .split('/')
      .filter(p => p && !p.startsWith(':'))
      .join('/');
    
    // Look for matching route files
    const routePatterns = [
      `routes/${routeParts}`,
      `api/${routeParts}`,
      `src/routes/${routeParts}`,
      `src/api/${routeParts}`,
      `controllers/${routeParts}Controller`,
      `src/controllers/${routeParts}Controller`
    ];
    
    for (const pattern of routePatterns) {
      const match = repoFiles.find(file => 
        file.path.includes(pattern) &&
        (file.path.endsWith('.js') || 
         file.path.endsWith('.ts') ||
         file.path.endsWith('.jsx') ||
         file.path.endsWith('.tsx'))
      );
      if (match) return match;
    }
  } catch (e) {
    // Not a valid URL, skip
  }
  
  return null;
};

/**
 * Strategy 4: Match by parameter name (for API vulnerabilities)
 */
const matchByParam = (vuln, repoFiles) => {
  if (!vuln.param) return null;
  
  // Common patterns for parameter usage
  const paramName = vuln.param;
  const searchPatterns = [
    `${paramName}.js`,
    `${paramName}.ts`,
    `${paramName}Controller.js`,
    `${paramName}Controller.ts`,
    `${paramName}Route.js`,
    `${paramName}Route.ts`
  ];
  
  for (const pattern of searchPatterns) {
    const match = repoFiles.find(file => 
      file.path.endsWith(pattern)
    );
    if (match) return match;
  }
  
  return null;
};

/**
 * Strategy 5: Match by vulnerability pattern
 */
const matchByPattern = (vuln, repoFiles) => {
  const vulnName = vuln.name.toLowerCase();
  
  // XSS vulnerabilities -> look for frontend files
  if (vulnName.includes('xss') || vulnName.includes('cross-site scripting')) {
    const frontendFiles = repoFiles.filter(file => 
      file.path.match(/\.(jsx|tsx|vue|html)$/) &&
      file.path.includes('components/')
    );
    if (frontendFiles.length > 0) return frontendFiles[0];
  }
  
  // SQL Injection -> look for database files
  if (vulnName.includes('sql injection')) {
    const dbFiles = repoFiles.filter(file => 
      file.path.match(/\.(js|ts)$/) &&
      (file.path.includes('model') || 
       file.path.includes('database') ||
       file.path.includes('query'))
    );
    if (dbFiles.length > 0) return dbFiles[0];
  }
  
  // Auth issues -> look for auth files
  if (vulnName.includes('auth') || vulnName.includes('authentication')) {
    const authFiles = repoFiles.filter(file => 
      file.path.match(/\.(js|ts)$/) &&
      (file.path.includes('auth') || 
       file.path.includes('login') ||
       file.path.includes('session'))
    );
    if (authFiles.length > 0) return authFiles[0];
  }
  
  // CSRF -> look for forms or middleware
  if (vulnName.includes('csrf')) {
    const csrfFiles = repoFiles.filter(file => 
      file.path.match(/\.(js|ts)$/) &&
      (file.path.includes('middleware') || 
       file.path.includes('csrf'))
    );
    if (csrfFiles.length > 0) return csrfFiles[0];
  }
  
  // API vulnerabilities -> look for route/controller files
  if (vulnName.includes('api') || vuln.method) {
    const apiFiles = repoFiles.filter(file => 
      file.path.match(/\.(js|ts)$/) &&
      (file.path.includes('route') || 
       file.path.includes('controller') ||
       file.path.includes('api'))
    );
    if (apiFiles.length > 0) return apiFiles[0];
  }
  
  return null;
};

/**
 * Calculate confidence score for a mapping
 */
const calculateConfidence = (vuln, file) => {
  let score = 0;
  
  // Exact path match = highest confidence
  if (vuln.file && file.path === vuln.file) {
    score = 100;
  }
  // Filename match
  else if (vuln.file && file.path.endsWith(vuln.file.split('/').pop())) {
    score = 80;
  }
  // Pattern match
  else {
    score = 50;
  }
  
  return score;
};

/**
 * Get file extension from path
 */
export const getFileExtension = (filepath) => {
  return filepath.split('.').pop().toLowerCase();
};

/**
 * Detect programming language from file extension
 */
export const detectLanguage = (filepath) => {
  const ext = getFileExtension(filepath);
  
  const langMap = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'java': 'java',
    'php': 'php',
    'rb': 'ruby',
    'go': 'go',
    'rs': 'rust',
    'cpp': 'cpp',
    'c': 'c',
    'cs': 'csharp',
    'vue': 'vue',
    'html': 'html',
    'css': 'css',
    'scss': 'scss'
  };
  
  return langMap[ext] || 'plaintext';
};

/**
 * Group vulnerabilities by file
 */
export const groupVulnerabilitiesByFile = (vulnerabilities, mappings) => {
  const grouped = {};
  
  vulnerabilities.forEach(vuln => {
    const vulnId = vuln._id || vuln.name;
    const mapping = mappings[vulnId];
    
    if (!mapping) return;
    
    const filepath = mapping.file.path;
    
    if (!grouped[filepath]) {
      grouped[filepath] = {
        file: mapping.file,
        vulnerabilities: []
      };
    }
    
    grouped[filepath].vulnerabilities.push(vuln);
  });
  
  return grouped;
};

/**
 * Get suggested fix type based on vulnerability
 */
export const getSuggestedFixType = (vuln) => {
  const name = vuln.name.toLowerCase();
  
  if (name.includes('xss')) return 'sanitization';
  if (name.includes('sql injection')) return 'parameterization';
  if (name.includes('csrf')) return 'token-validation';
  if (name.includes('auth')) return 'authentication';
  if (name.includes('api key') || name.includes('secret')) return 'configuration';
  if (name.includes('rate limit')) return 'middleware';
  
  return 'code-change';
};