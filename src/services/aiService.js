// // src/services/aiService.js - Complete AI Service Implementation
// // ✅ Includes: Fix Generation, PR Creation, and Report Generation

// const { GoogleGenerativeAI } = require('@google/generative-ai');
// const { Octokit } = require('@octokit/rest');
// const Scan = require('../models/Scan');
// const User = require('../models/User');

// class AIService {
//   constructor() {
//     if (!process.env.GEMINI_API_KEY) {
//       console.warn('⚠️  GEMINI_API_KEY not set. AI features will not work.');
//     }
    
//     this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    
//     // Use gemini-2.5-flash with generationConfig
//     this.model = this.genAI.getGenerativeModel({ 
//       model: 'gemini-2.5-flash',
//       generationConfig: {
//         temperature: 0.7,
//         topP: 0.95,
//         topK: 40,
//         maxOutputTokens: 2048,
//       }
//     });

//     // Fallback models if primary fails
//     this.modelPriority = [
//       'gemini-2.5-flash',
//       'gemini-2.5-pro',
//       'gemini-2.0-flash'
//     ];
//   }

//   /**
//    * Generate AI fix for a specific vulnerability
//    * @param {string} scanId - Scan ID
//    * @param {number} vulnIndex - Vulnerability index in array
//    * @param {string} userId - User ID for authorization
//    * @returns {Promise<Object>} Generated fix data
//    */
//   async generateFixForVulnerability(scanId, vulnIndex, userId) {
//     try {
//       console.log(`🤖 Generating fix for scan ${scanId}, vuln ${vulnIndex}`);
      
//       const scan = await Scan.findById(scanId);
      
//       if (!scan) {
//         throw new Error('Scan not found');
//       }

//       if (scan.userId && scan.userId.toString() !== userId) {
//         throw new Error('Unauthorized');
//       }

//       const vulnerability = scan.vulnerabilities[vulnIndex];
      
//       if (!vulnerability) {
//         throw new Error('Vulnerability not found at index ' + vulnIndex);
//       }

//       console.log(`🔍 Analyzing: ${vulnerability.name}`);

//       // Generate comprehensive fix using AI
//       const prompt = `
// You are a senior security engineer and code reviewer. Generate a secure code fix for this vulnerability.

// VULNERABILITY DETAILS:
// Name: ${vulnerability.name}
// Severity: ${vulnerability.severity}
// CWE ID: ${vulnerability.cweid || 'N/A'}
// Description: ${vulnerability.description || 'No description provided'}

// EVIDENCE/CONTEXT:
// ${vulnerability.evidence || 'No specific code evidence available'}

// URL/LOCATION:
// ${vulnerability.url || 'Not specified'}

// FILE/PARAMETER:
// ${vulnerability.file || vulnerability.param || 'Not specified'}

// SOLUTION SUGGESTED:
// ${vulnerability.solution || 'No specific solution provided'}

// YOUR TASK:
// Generate a complete security fix response with:

// 1. **Clear Explanation** (2-3 sentences): What's wrong and why it's dangerous
// 2. **Secure Code Fix**: The exact code to fix this issue (if applicable)
//    - If this is a configuration issue, provide the secure configuration
//    - If this is an implementation issue, provide the secure implementation
//    - Make it copy-paste ready and production-quality
// 3. **Best Practices** (3-4 bullet points): How to prevent this in the future

// IMPORTANT:
// - Format your response ONLY as a valid JSON object
// - Do NOT include any markdown formatting, code blocks, or backticks
// - The JSON must be parseable

// Response format:
// {
//   "explanation": "Clear explanation here",
//   "fixedCode": "The complete secure code or configuration here",
//   "bestPractices": [
//     "First best practice",
//     "Second best practice",
//     "Third best practice"
//   ]
// }
// `;

//       let result;
//       let responseText;
//       let lastError;

//       // Try models in order if primary fails
//       for (const modelName of this.modelPriority) {
//         try {
//           const model = this.genAI.getGenerativeModel({ model: modelName });
//           result = await model.generateContent(prompt);
//           responseText = result.response.text();
//           console.log(`✅ Successfully used model: ${modelName}`);
//           break;
//         } catch (err) {
//           lastError = err;
//           console.warn(`⚠️ Model ${modelName} failed, trying next...`);
//         }
//       }

//       if (!responseText) {
//         throw lastError || new Error('All models failed to generate content');
//       }
      
//       console.log('🤖 AI Response received:', responseText.substring(0, 200) + '...');
      
//       // Clean up response - remove markdown code blocks if present
//       let cleanedResponse = responseText.trim();
      
//       // Remove ```json and ``` markers
//       cleanedResponse = cleanedResponse.replace(/```json\n?/g, '');
//       cleanedResponse = cleanedResponse.replace(/```\n?/g, '');
//       cleanedResponse = cleanedResponse.trim();
      
//       // Extract JSON from response
//       const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
//       if (!jsonMatch) {
//         console.error('Failed to find JSON in response:', cleanedResponse);
//         throw new Error('Failed to parse AI response - no JSON found');
//       }
      
//       const aiResponse = JSON.parse(jsonMatch[0]);

//       // Validate response structure
//       if (!aiResponse.explanation || !aiResponse.fixedCode || !aiResponse.bestPractices) {
//         throw new Error('Invalid AI response structure');
//       }

//       console.log('✅ AI fix generated successfully');

//       // Update vulnerability with AI-generated fix
//       scan.vulnerabilities[vulnIndex].aiExplanation = aiResponse.explanation;
//       scan.vulnerabilities[vulnIndex].aiFixedCode = aiResponse.fixedCode;
//       scan.vulnerabilities[vulnIndex].aiBestPractices = aiResponse.bestPractices;
//       scan.vulnerabilities[vulnIndex].aiGeneratedAt = new Date();
      
//       await scan.save();

//       return {
//         success: true,
//         data: {
//           explanation: aiResponse.explanation,
//           fixedCode: aiResponse.fixedCode,
//           bestPractices: aiResponse.bestPractices
//         }
//       };
//     } catch (error) {
//       console.error('❌ Generate fix error:', error);
//       throw error;
//     }
//   }

//   async analyzeRepositoryFiles(files) {
//     try {
//       console.log(`🤖 Analyzing ${files.length} files with AI...`);
      
//       const prompt = `
//         You are an expert Static Application Security Testing (SAST) tool. 
//         Analyze the following source code files for security vulnerabilities.
        
//         FILES TO ANALYZE:
//         ${files.map(f => `
//         --- FILE: ${f.path} ---
//         ${f.content}
//         -----------------------
//         `).join('\n')}

//         INSTRUCTIONS:
//         1. Identify security issues (OWASP Top 10, logic flaws, secrets).
//         2. Ignore minor code style issues.
//         3. For each issue, you MUST provide the exact file path provided above.
        
//         OUTPUT FORMAT (JSON Array):
//         [
//           {
//             "name": "Short title of vulnerability",
//             "severity": "critical|high|medium|low",
//             "category": "owasp|broken|ui|code",
//             "description": "Detailed description",
//             "file": "EXACT_FILE_PATH_FROM_INPUT",
//             "line": 10,
//             "codeSnippet": "The vulnerable code line",
//             "solution": "How to fix it"
//           }
//         ]
//       `;

//       const result = await this.model.generateContent(prompt);
//       const text = result.response.text();
      
//       // Parse JSON safely
//       try {
//         const vulns = JSON.parse(text);
//         if (Array.isArray(vulns)) {
//           return vulns;
//         }
//         return [];
//       } catch (e) {
//         console.error("AI JSON Parse Error:", e);
//         return [];
//       }

//     } catch (error) {
//       console.error('❌ AI Analysis failed:', error);
//       return [];
//     }
//   }

//   /**
//    * Create a pull request with the AI-generated fix
//    * @param {string} scanId - Scan ID
//    * @param {number} vulnIndex - Vulnerability index
//    * @param {string} userId - User ID
//    * @param {Object} repoInfo - Repository information
//    * @returns {Promise<Object>} PR creation result
//    */
//   async createPullRequestWithFix(scanId, vulnIndex, userId, repoInfo) {
//     try {
//       console.log(`📝 Creating PR for scan ${scanId}, vuln ${vulnIndex}`);
      
//       const scan = await Scan.findById(scanId);
//       const user = await User.findById(userId).select('+githubAccessToken');

//       if (!scan || !user) {
//         throw new Error('Scan or user not found');
//       }

//       if (!user.githubAccessToken) {
//         throw new Error('GitHub not connected. Please connect your GitHub account.');
//       }

//       const vulnerability = scan.vulnerabilities[vulnIndex];

//       if (!vulnerability) {
//         throw new Error('Vulnerability not found');
//       }

//       if (!vulnerability.aiFixedCode) {
//         throw new Error('No AI fix generated. Please generate a fix first.');
//       }

//       // Decrypt GitHub token (assuming it's base64 encoded)
//       const token = this.decryptToken(user.githubAccessToken);
//       const octokit = new Octokit({ auth: token });

//       const { owner, repo, branch = 'main', filePath } = repoInfo;

//       if (!owner || !repo || !filePath) {
//         throw new Error('Repository owner, name, and file path are required');
//       }

//       console.log(`🔧 Creating PR in ${owner}/${repo} for ${filePath}`);

//       // 1. Get the base branch reference
//       const { data: refData } = await octokit.git.getRef({
//         owner,
//         repo,
//         ref: `heads/${branch}`
//       });

//       // 2. Create new branch for the fix
//       const timestamp = Date.now();
//       const branchName = `secureone-fix-${vulnerability.cweid || 'security'}-${timestamp}`;
      
//       console.log(`🌿 Creating branch: ${branchName}`);
      
//       try {
//         await octokit.git.createRef({
//           owner,
//           repo,
//           ref: `refs/heads/${branchName}`,
//           sha: refData.object.sha
//         });
//       } catch (error) {
//         if (error.status === 422) {
//           // Branch already exists
//           console.log('Branch already exists, using existing branch');
//         } else {
//           throw error;
//         }
//       }

//       // 3. Get current file content (if it exists)
//       let fileSha;
//       let fileExists = true;
      
//       try {
//         const { data: fileData } = await octokit.repos.getContent({
//           owner,
//           repo,
//           path: filePath,
//           ref: branch
//         });
//         fileSha = fileData.sha;
//         console.log(`📄 File exists, SHA: ${fileSha}`);
//       } catch (error) {
//         if (error.status === 404) {
//           fileExists = false;
//           console.log('📄 File does not exist, will create new file');
//         } else {
//           throw error;
//         }
//       }

//       // 4. Create or update the file with the fix
//       const commitMessage = `🔒 Security Fix: ${vulnerability.name}

// ${vulnerability.aiExplanation}

// Severity: ${vulnerability.severity.toUpperCase()}
// CWE: ${vulnerability.cweid || 'N/A'}
// Category: ${vulnerability.category}

// Generated by SecureOne AI Security Scanner
// Scan ID: ${scanId}
// `;

//       console.log('💾 Committing fix to branch...');

//       await octokit.repos.createOrUpdateFileContents({
//         owner,
//         repo,
//         path: filePath,
//         message: commitMessage,
//         content: Buffer.from(vulnerability.aiFixedCode).toString('base64'),
//         sha: fileSha,
//         branch: branchName
//       });

//       // 5. Create pull request
//       const prTitle = `🛡️ [SecureOne] Fix ${vulnerability.severity.toUpperCase()}: ${vulnerability.name}`;
      
//       const prBody = `## 🔒 Security Fix: ${vulnerability.name}

// **Severity:** \`${vulnerability.severity.toUpperCase()}\`  
// **CWE ID:** ${vulnerability.cweid ? `\`CWE-${vulnerability.cweid}\`` : 'N/A'}  
// **Category:** \`${vulnerability.category}\`

// ### 📋 Vulnerability Details

// ${vulnerability.description || 'Security vulnerability detected by SecureOne scan'}

// ${vulnerability.url ? `**Affected URL:** \`${vulnerability.url}\`` : ''}
// ${vulnerability.param ? `**Parameter:** \`${vulnerability.param}\`` : ''}
// ${vulnerability.method ? `**Method:** \`${vulnerability.method}\`` : ''}

// ### 🤖 AI Analysis

// ${vulnerability.aiExplanation}

// ### ✅ Best Practices

// ${vulnerability.aiBestPractices ? vulnerability.aiBestPractices.map(bp => `- ${bp}`).join('\n') : ''}

// ### 🔧 Changes Made

// This PR includes the AI-generated secure code fix for the identified vulnerability.

// ---

// **🛡️ Generated by [SecureOne](https://github.com/yourusername/secureone) Security Scanner**  
// Scan ID: \`${scanId}\`  
// Vulnerability Index: ${vulnIndex}

// *Please review the changes carefully before merging.*
// `;

//       console.log('📬 Creating pull request...');

//       const { data: pr } = await octokit.pulls.create({
//         owner,
//         repo,
//         title: prTitle,
//         head: branchName,
//         base: branch,
//         body: prBody,
//         maintainer_can_modify: true
//       });

//       console.log(`✅ PR created: ${pr.html_url}`);

//       // 6. Update scan with PR info
//       scan.vulnerabilities[vulnIndex].prUrl = pr.html_url;
//       scan.vulnerabilities[vulnIndex].prNumber = pr.number;
//       scan.vulnerabilities[vulnIndex].prBranch = branchName;
//       scan.vulnerabilities[vulnIndex].prCreatedAt = new Date();
//       await scan.save();

//       return {
//         success: true,
//         data: {
//           prUrl: pr.html_url,
//           prNumber: pr.number,
//           branch: branchName,
//           title: pr.title
//         }
//       };
//     } catch (error) {
//       console.error('❌ Create PR error:', error);
      
//       // Provide more helpful error messages
//       if (error.status === 404) {
//         throw new Error('Repository not found. Make sure you have access to this repository.');
//       } else if (error.status === 403) {
//         throw new Error('Permission denied. Make sure your GitHub token has the required scopes.');
//       } else if (error.status === 422) {
//         throw new Error('Invalid request. The branch might already exist or the file path is invalid.');
//       }
      
//       throw error;
//     }
//   }

//   /**
//    * Generate simplified report for all vulnerabilities
//    * Called automatically after scan completion
//    * @param {string} scanId - Scan ID
//    * @param {Array} vulnerabilities - Array of vulnerabilities
//    * @returns {Promise<string>} Generated summary
//    */
//   async generateSimplifiedReport(scanId, vulnerabilities) {
//     try {
//       if (!vulnerabilities || vulnerabilities.length === 0) {
//         console.log('No vulnerabilities to summarize');
//         return 'No vulnerabilities found. Application appears secure.';
//       }

//       console.log(`📊 Generating AI summary for ${vulnerabilities.length} vulnerabilities`);
      
//       // Get top 5 most severe vulnerabilities
//       const topVulns = vulnerabilities
//         .sort((a, b) => {
//           const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
//           return (severityOrder[a.severity] || 5) - (severityOrder[b.severity] || 5);
//         })
//         .slice(0, 5);
      
//       const prompt = `
// You are a security analyst. Provide a brief executive summary of these security findings.

// Vulnerabilities found:
// ${topVulns.map((v, i) => `${i+1}. ${v.name} (${v.severity.toUpperCase()})`).join('\n')}

// Total vulnerabilities: ${vulnerabilities.length}

// Write a 2-3 sentence summary that:
// 1. Highlights the most critical issues
// 2. Gives an overall security assessment
// 3. Is actionable and non-technical

// Keep it concise and professional.
// `;

//       const result = await this.model.generateContent(prompt);
//       const summary = result.response.text().trim();

//       console.log('✅ AI summary generated');

//       // Update scan with summary
//       await Scan.findByIdAndUpdate(scanId, {
//         aiSummary: summary,
//         aiSummaryGeneratedAt: new Date()
//       });

//       return summary;
//     } catch (error) {
//       console.error('❌ Generate report error:', error);
//       // Don't throw - this is a nice-to-have feature
//       return null;
//     }
//   }

//   /**
//    * Decrypt GitHub access token
//    * @param {string} encrypted - Base64 encoded token
//    * @returns {string} Decrypted token
//    */
//   decryptToken(encrypted) {
//     try {
//       return Buffer.from(encrypted, 'base64').toString('utf-8');
//     } catch (error) {
//       throw new Error('Failed to decrypt GitHub token');
//     }
//   }
// }

// // Export singleton instance
// module.exports = new AIService();
















// src/services/aiService.js

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Octokit } = require('@octokit/rest');
const Scan = require('../models/Scan');
const User = require('../models/User');

class AIService {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('⚠️  GEMINI_API_KEY not set. AI features will not work.');
    }
    
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    
    // Use gemini-2.5-flash for speed/cost balance
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.2,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      }
    });

    this.modelPriority = [
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-2.0-flash'
    ];
  }

  /**
   * Analyze a batch of code files for vulnerabilities
   * ✅ NEW: Adds line numbers to input so AI can return exact location
   */
  async analyzeRepositoryFiles(files) {
    try {
      console.log(`🤖 AI Service: Analyzing batch of ${files.length} files...`);
      
      const prompt = `
        You are an expert Static Application Security Testing (SAST) tool. 
        Analyze the following source code files for security vulnerabilities.
        
        FILES TO ANALYZE:
        ${files.map(f => {
          // ✅ ADDED: Line numbers for accurate reporting
          const codeWithLines = f.content.split('\n').map((line, i) => `${i + 1} | ${line}`).join('\n');
          return `
          --- BEGIN FILE: ${f.path} ---
          ${codeWithLines}
          --- END FILE ---
          `;
        }).join('\n')}

        INSTRUCTIONS:
        1. Identify security issues (OWASP Top 10, logic flaws, secrets, dangerous dependencies).
        2. Ignore minor code style issues or "TODO" comments unless they pose a security risk.
        3. CRITICAL: For the "file" field, you MUST return the EXACT path string provided in the "BEGIN FILE" header.
        4. CRITICAL: For the "line" field, provide the EXACT line number where the issue starts (based on the numbered input provided).
        
        OUTPUT FORMAT (Return a JSON Array only):
        [
          {
            "name": "Short title of vulnerability",
            "severity": "critical|high|medium|low",
            "category": "owasp|broken|ui|code",
            "description": "Detailed description of the risk",
            "file": "exact/path/from/input.js", 
            "line": 15, 
            "codeSnippet": "The specific line of code causing the issue",
            "solution": "High-level explanation of how to fix it"
          }
        ]
      `;

      let result;
      let responseText;

      // Retry logic with model priority
      for (const modelName of this.modelPriority) {
        try {
          const model = this.genAI.getGenerativeModel({ 
            model: modelName,
            generationConfig: { responseMimeType: "application/json" }
          });
          result = await model.generateContent(prompt);
          responseText = result.response.text();
          break; // Success
        } catch (err) {
          console.warn(`⚠️ Model ${modelName} failed, trying next...`);
        }
      }

      if (!responseText) return [];

      // Parse JSON safely
      try {
        const vulns = JSON.parse(responseText);
        return Array.isArray(vulns) ? vulns : [];
      } catch (e) {
        console.error("AI JSON Parse Error:", e);
        const cleanText = responseText.replace(/```json|```/g, '').trim();
        try { return JSON.parse(cleanText); } catch (err) { return []; }
      }

    } catch (error) {
      console.error('❌ AI Analysis failed:', error);
      return [];
    }
  }

  /**
   * Generate AI fix for a specific vulnerability
   */
  async generateFixForVulnerability(scanId, vulnIndex, userId) {
    try {
      console.log(`🤖 Generating fix for scan ${scanId}, vuln ${vulnIndex}`);
      
      const scan = await Scan.findById(scanId);
      if (!scan) throw new Error('Scan not found');
      if (scan.userId && scan.userId.toString() !== userId) throw new Error('Unauthorized');

      const vulnerability = scan.vulnerabilities[vulnIndex];
      if (!vulnerability) throw new Error('Vulnerability not found at index ' + vulnIndex);

      const prompt = `
        You are a senior security engineer. Generate a secure code fix.

        VULNERABILITY: ${vulnerability.name}
        DESCRIPTION: ${vulnerability.description}
        FILE: ${vulnerability.file}
        LINE: ${vulnerability.line || 'Unknown'}
        CONTEXT: ${vulnerability.codeSnippet || 'Not provided'}

        Response format (JSON):
        {
          "explanation": "Clear explanation of why this is a fix",
          "fixedCode": "The complete, secure replacement code block",
          "bestPractices": ["Practice 1", "Practice 2"]
        }
      `;

      // Use the primary model for fixes
      const model = this.genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash', 
        generationConfig: { responseMimeType: "application/json" }
      });
      
      const result = await model.generateContent(prompt);
      const aiResponse = JSON.parse(result.response.text());

      // Update vulnerability with fix data
      scan.vulnerabilities[vulnIndex].aiExplanation = aiResponse.explanation;
      scan.vulnerabilities[vulnIndex].aiFixedCode = aiResponse.fixedCode;
      scan.vulnerabilities[vulnIndex].aiBestPractices = aiResponse.bestPractices;
      scan.vulnerabilities[vulnIndex].aiGeneratedAt = new Date();
      
      await scan.save();

      return { success: true, data: aiResponse };
    } catch (error) {
      console.error('❌ Generate fix error:', error);
      throw error;
    }
  }

  /**
   * Create a pull request with the AI-generated fix
   */
  async createPullRequestWithFix(scanId, vulnIndex, userId, repoInfo) {
    try {
      console.log(`📝 Creating PR for scan ${scanId}, vuln ${vulnIndex}`);
      
      const scan = await Scan.findById(scanId);
      const user = await User.findById(userId).select('+githubAccessToken');

      if (!scan || !user || !user.githubAccessToken) throw new Error('Invalid request or missing GitHub token');

      const vulnerability = scan.vulnerabilities[vulnIndex];
      if (!vulnerability || !vulnerability.aiFixedCode) throw new Error('Fix not generated yet');

      const token = this.decryptToken(user.githubAccessToken);
      const octokit = new Octokit({ auth: token });
      const { owner, repo, branch = 'main', filePath } = repoInfo;

      // 1. Get Base SHA
      const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
      
      // 2. Create Branch
      const branchName = `secureone-fix-${Date.now()}`;
      await octokit.git.createRef({
        owner, repo, ref: `refs/heads/${branchName}`, sha: refData.object.sha
      });

      // 3. Get File SHA
      let fileSha;
      try {
        const { data: fileData } = await octokit.repos.getContent({ owner, repo, path: filePath, ref: branch });
        fileSha = fileData.sha;
      } catch (e) {
        if (e.status !== 404) throw e;
      }

      // 4. Update File
      await octokit.repos.createOrUpdateFileContents({
        owner, repo, path: filePath,
        message: `🔒 Security Fix: ${vulnerability.name}`,
        content: Buffer.from(vulnerability.aiFixedCode).toString('base64'),
        sha: fileSha,
        branch: branchName
      });

      // 5. Create PR
      const { data: pr } = await octokit.pulls.create({
        owner, repo,
        title: `🛡️ Security Fix: ${vulnerability.name}`,
        head: branchName,
        base: branch,
        body: `## Security Fix\n\n**Vulnerability:** ${vulnerability.name}\n\n${vulnerability.aiExplanation}`
      });

      // 6. Save State
      scan.vulnerabilities[vulnIndex].prUrl = pr.html_url;
      scan.vulnerabilities[vulnIndex].prNumber = pr.number;
      await scan.save();

      return { success: true, data: { prUrl: pr.html_url } };
    } catch (error) {
      console.error('❌ Create PR error:', error);
      throw error;
    }
  }

  async generateSimplifiedReport(scanId, vulnerabilities) {
    try {
      if (!vulnerabilities?.length) return 'No vulnerabilities found.';
      
      const prompt = `Summarize these security findings for a non-technical executive: ${JSON.stringify(vulnerabilities.slice(0, 5))}`;
      const result = await this.model.generateContent(prompt);
      const summary = result.response.text();
      
      await Scan.findByIdAndUpdate(scanId, { aiSummary: summary });
      return summary;
    } catch (e) { return null; }
  }

  decryptToken(encrypted) {
    try {
      return Buffer.from(encrypted, 'base64').toString('utf-8');
    } catch (error) {
      throw new Error('Failed to decrypt GitHub token');
    }
  }
}

module.exports = new AIService();