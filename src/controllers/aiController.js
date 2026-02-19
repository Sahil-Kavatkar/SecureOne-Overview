// // src/controllers/aiController.js

// const { GoogleGenerativeAI } = require('@google/generative-ai');
// const Scan = require('../models/Scan');
// const User = require('../models/User');
// const { Octokit } = require('@octokit/rest');

// class AIController {
//   constructor() {
//     this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
//     this.model = this.genAI.getGenerativeModel({ 
//       model: "gemini-2.0-flash",
//       generationConfig: {
//         temperature: 0.2,
//         topK: 40,
//         topP: 0.95,
//         maxOutputTokens: 8192,
//       }
//     });
    
//     this.REQUEST_TIMEOUT = 60000;
//   }

//   decryptToken(encrypted) {
//     if (!encrypted) return null;
//     try {
//       return Buffer.from(encrypted, 'base64').toString('utf-8');
//     } catch (e) {
//       console.error('Token decryption failed:', e);
//       return null;
//     }
//   }

//   /**
//    * Explain vulnerability with AI
//    */
//   async explainVulnerability(req, res, next) {
//     try {
//       const { vulnerability } = req.body;
      
//       const vulnName = typeof vulnerability === 'string' ? vulnerability : vulnerability?.name;
//       const vulnSeverity = vulnerability?.severity || 'Unknown';
//       const vulnDesc = vulnerability?.description || '';

//       if (!vulnName) {
//         return res.status(400).json({ 
//           success: false, 
//           message: 'Vulnerability name is required' 
//         });
//       }

//       const prompt = `You are a cybersecurity expert. Explain this vulnerability concisely:

// Vulnerability: ${vulnName}
// Severity: ${vulnSeverity}
// ${vulnDesc ? `Description: ${vulnDesc}` : ''}

// Return ONLY valid JSON in this exact format:
// {
//   "summary": "2-3 sentence explanation in simple terms",
//   "impact": "Real-world security impact and risks",
//   "exploitation": "How attackers could exploit this vulnerability"
// }`;

//       const resultPromise = this.model.generateContent(prompt);
//       const timeoutPromise = new Promise((_, reject) => 
//         setTimeout(() => reject(new Error('Request timeout')), this.REQUEST_TIMEOUT)
//       );

//       const result = await Promise.race([resultPromise, timeoutPromise]);
//       const text = result.response.text().replace(/```json|```/g, '').trim();
      
//       let data;
//       try {
//         data = JSON.parse(text);
//       } catch (e) {
//         data = { 
//           summary: text.substring(0, 500),
//           impact: 'See summary above',
//           exploitation: 'See summary above'
//         };
//       }

//       const explanation = `${data.summary}\n\n**Impact:** ${data.impact}\n\n**How it's exploited:** ${data.exploitation}`;

//       res.json({
//         success: true,
//         data: {
//           vulnerability: vulnName,
//           explanation
//         }
//       });
//     } catch (error) {
//       console.error('AI explain error:', error);
      
//       if (error.message === 'Request timeout') {
//         return res.status(504).json({ 
//           success: false, 
//           message: 'AI request timed out. Please try again.' 
//         });
//       }
      
//       res.status(500).json({ 
//         success: false, 
//         message: 'AI explanation service temporarily unavailable'
//       });
//     }
//   }

//   /**
//    * Generate secure code fix with AI
//    */
//   async generateFix(req, res, next) {
//     try {
//       let { vulnerability, codeContext, code, language, lineNumber, filePath, repoOwner, repoName, branch, scanId, vulnerabilityId } = req.body;

//       let actualCode = codeContext || code;
//       let fetchedFromGitHub = false;
//       let originalFilePath = filePath;

//       // Fetch real code from GitHub if details are present
//       if (repoOwner && repoName && filePath && req.user) {
//         console.log(`📡 Attempting to fetch code for fix: ${repoOwner}/${repoName}/${filePath} line ${lineNumber}`);
//         try {
//           const user = await User.findById(req.user.id).select('+githubAccessToken');
//           const token = this.decryptToken(user.githubAccessToken);
          
//           if (token) {
//             const octokit = new Octokit({ auth: token });
//             const { data } = await octokit.repos.getContent({
//               owner: repoOwner,
//               repo: repoName,
//               path: filePath,
//               ref: branch || 'main'
//             });

//             if (data.content) {
//               const fullContent = Buffer.from(data.content, 'base64').toString('utf-8');
//               const lines = fullContent.split('\n');
              
//               const targetLine = parseInt(lineNumber);
              
//               if (!isNaN(targetLine) && targetLine > 0) {
//                 const lineIndex = targetLine - 1;
//                 const start = Math.max(0, lineIndex - 15);
//                 const end = Math.min(lines.length, lineIndex + 15);
                
//                 actualCode = lines.slice(start, end).join('\n');
//                 console.log(`✅ Fetched ${end - start} lines of real code context from GitHub.`);
//                 fetchedFromGitHub = true;
//               } else {
//                 actualCode = lines.slice(0, 50).join('\n');
//                 console.log(`⚠️ Invalid line number (${lineNumber}), used first 50 lines.`);
//                 fetchedFromGitHub = true;
//               }
//             }
//           }
//         } catch (fetchError) {
//           console.error('❌ Failed to fetch real code from GitHub:', fetchError.message);
//         }
//       }

//       const vulnName = typeof vulnerability === 'string' ? vulnerability : vulnerability?.name;
//       const vulnSeverity = vulnerability?.severity || 'Unknown';
//       const vulnDescription = vulnerability?.description || '';

//       if (!vulnName) {
//         return res.status(400).json({ 
//           success: false, 
//           message: 'Vulnerability data required' 
//         });
//       }

//       // If no code context is available, generate general advice
//       if (!actualCode || actualCode.trim() === '') {
//         return this.generateGeneralFix(req, res, { 
//           name: vulnName, 
//           severity: vulnSeverity,
//           description: vulnDescription 
//         });
//       }

//       const detectedLang = language || this.detectLanguage(actualCode) || 'javascript';

//       const prompt = `You are a DevSecOps expert fixing a security vulnerability.

// VULNERABILITY: ${vulnName}
// SEVERITY: ${vulnSeverity}
// DESCRIPTION: ${vulnDescription}

// FILE: ${filePath || 'unknown'}
// LANGUAGE: ${detectedLang}
// ${lineNumber ? `LINE: ${lineNumber}` : ''}

// VULNERABLE CODE:
// \`\`\`${detectedLang}
// ${actualCode}
// \`\`\`

// INSTRUCTIONS:
// 1. Analyze if this can be fixed by modifying the code above.
// 2. If YES, provide the COMPLETE fixed code block - do NOT return instructions.
// 3. If NO, set isCodeFix to false and provide detailed step-by-step instructions.
// 4. PRESERVE exact indentation and formatting of the original code.
// 5. ONLY change what's necessary to fix the vulnerability.
// 6. DO NOT add any explanatory comments like "// Fixed code:" or "// Solution:".
// 7. DO NOT wrap the code in markdown or backticks in the fixedCode field.

// Return ONLY valid JSON:
// {
//   "isCodeFix": boolean,
//   "fixedCode": "COMPLETE secure code here (MUST be null if isCodeFix is false)",
//   "explanation": "Brief explanation of what was changed and why (max 2 sentences)",
//   "textSolution": "Detailed step-by-step remediation instructions (if isCodeFix is false)",
//   "securityNotes": "Additional security best practices"
// }`;

//       const result = await this.model.generateContent(prompt);
//       const text = result.response.text().replace(/```json|```/g, '').trim();
      
//       let jsonResponse;
//       try {
//         jsonResponse = JSON.parse(text);
//       } catch (e) {
//         console.error('JSON parse error:', e);
//         jsonResponse = { 
//           isCodeFix: false, 
//           explanation: 'Could not parse AI response',
//           textSolution: text.substring(0, 1000)
//         };
//       }

//       // Clean up fixedCode - remove any markdown or explanatory comments
//       if (jsonResponse.fixedCode && jsonResponse.isCodeFix) {
//         jsonResponse.fixedCode = jsonResponse.fixedCode
//           .replace(/^```[\w]*\n?/g, '')
//           .replace(/```$/g, '')
//           .replace(/^\/\/ (Fixed|Secure|Solution|Proposed).*?\n/gm, '')
//           .replace(/^#.*?\n/gm, '')
//           .trim();
//       }

//       const responseData = {
//         vulnerability: vulnName,
//         originalCode: actualCode,
//         fixedCode: jsonResponse.isCodeFix ? jsonResponse.fixedCode : null,
//         explanation: jsonResponse.explanation || 'Security fix generated',
//         textSolution: jsonResponse.isCodeFix ? null : (jsonResponse.textSolution || jsonResponse.explanation),
//         securityNotes: jsonResponse.securityNotes,
//         isCodeFix: jsonResponse.isCodeFix || false,
//         language: detectedLang,
//         lineNumber: lineNumber,
//         filePath: originalFilePath,
//         fetchedFromGitHub: fetchedFromGitHub
//       };

//       // ✅ SAVE FIX TO DATABASE
//       if (scanId && vulnerabilityId) {
//         try {
//           const scan = await Scan.findById(scanId);
//           if (scan) {
//             const vuln = scan.vulnerabilities.id(vulnerabilityId);
//             if (vuln) {
//               vuln.aiExplanation = responseData.explanation;
//               vuln.aiFixedCode = responseData.fixedCode;
//               vuln.aiBestPractices = responseData.securityNotes ? [responseData.securityNotes] : [];
//               vuln.aiGeneratedAt = new Date();
//               vuln.aiFixApplied = false;
              
//               await scan.save();
//               console.log(`✅ Saved AI fix for vulnerability ${vulnerabilityId}`);
//             }
//           }
//         } catch (saveError) {
//           console.error('Failed to save AI fix:', saveError);
//         }
//       }

//       res.json({
//         success: true,
//         data: responseData
//       });

//     } catch (error) {
//       console.error('AI fix generation error:', error);
//       res.status(500).json({ 
//         success: false, 
//         message: 'Failed to generate fix',
//         error: error.message
//       });
//     }
//   }

//   /**
//    * Generate general fix recommendations
//    */
//   async generateGeneralFix(req, res, vulnerability) {
//     try {
//       const prompt = `You are a cybersecurity expert. Provide remediation guidance for this vulnerability:

// Vulnerability: ${vulnerability.name}
// Severity: ${vulnerability.severity || 'Unknown'}
// ${vulnerability.description ? `Description: ${vulnerability.description}` : ''}

// Provide detailed step-by-step remediation instructions in JSON format:
// {
//   "isCodeFix": false,
//   "explanation": "Brief overview of the vulnerability and remediation approach",
//   "textSolution": "Detailed step-by-step remediation instructions with code examples if applicable",
//   "securityNotes": "Additional security best practices and preventative measures"
// }`;

//       const result = await this.model.generateContent(prompt);
//       const text = result.response.text().replace(/```json|```/g, '').trim();
//       const data = JSON.parse(text);

//       res.json({
//         success: true,
//         data: {
//           vulnerability: vulnerability.name,
//           isCodeFix: false,
//           explanation: data.explanation,
//           textSolution: data.textSolution,
//           securityNotes: data.securityNotes,
//           originalCode: null,
//           fixedCode: null
//         }
//       });
//     } catch (error) {
//       console.error('General fix generation error:', error);
//       res.status(500).json({ 
//         success: false, 
//         message: 'Failed to generate fix recommendations' 
//       });
//     }
//   }

//   /**
//    * ✅ UPDATED: Map vulnerabilities to files - PRIORITIZES GEMINI'S DIRECT MAPPINGS
//    */
//   async mapVulnerabilities(req, res) {
//     try {
//       const { scanId, repoOwner, repoName, filePaths, branch = 'main' } = req.body;
//       const userId = req.user.id;

//       if (!filePaths || filePaths.length === 0) {
//         return res.status(400).json({ success: false, message: 'No files selected for mapping' });
//       }

//       const user = await User.findById(userId).select('+githubAccessToken');
//       if (!user.githubAccessToken) {
//         return res.status(403).json({ success: false, message: 'GitHub not connected' });
//       }

//       const scan = await Scan.findById(scanId);
//       if (!scan) return res.status(404).json({ success: false, message: 'Scan not found' });

//       // 🎯 GEMINI ALREADY PROVIDES FILE AND LINE NUMBERS!
//       const mappings = {};
      
//       scan.vulnerabilities.forEach(vuln => {
//         const vulnId = vuln._id || vuln.id;
        
//         // If Gemini already provided file and line, use them directly
//         if (vuln.file && vuln.line) {
//           // Check if the file exists in the selected files
//           const matchedFile = filePaths.find(p => 
//             p === vuln.file || 
//             p.endsWith(vuln.file) ||
//             vuln.file.endsWith(p.split('/').pop())
//           );
          
//           if (matchedFile) {
//             mappings[vulnId] = {
//               file: vuln.file,
//               line: parseInt(vuln.line),
//               confidence: 'high',
//               matchedBy: 'gemini-direct'
//             };
//           }
//         }
//       });

//       // If Gemini didn't provide locations, use AI to find them
//       if (Object.keys(mappings).length === 0) {
//         console.log('⚠️ Gemini did not provide direct mappings, using AI fallback...');
        
//         const token = this.decryptToken(user.githubAccessToken);
//         if (!token) return res.status(403).json({ success: false, message: 'Invalid GitHub token' });

//         const octokit = new Octokit({ auth: token });

//         const fileContents = {};
        
//         // Fetch limited file contents for mapping
//         await Promise.all(filePaths.slice(0, 20).map(async (path) => {
//           try {
//             const { data } = await octokit.repos.getContent({
//               owner: repoOwner,
//               repo: repoName,
//               path: path,
//               ref: branch
//             });
            
//             if (data.content) {
//               fileContents[path] = Buffer.from(data.content, 'base64').toString('utf-8').substring(0, 5000);
//             }
//           } catch (e) {}
//         }));

//         const vulnerabilitiesList = scan.vulnerabilities.slice(0, 20).map(v => ({
//           id: v._id || v.id,
//           name: v.name,
//           description: v.description?.substring(0, 150) || '',
//           evidence: v.evidence?.substring(0, 150) || '',
//           file: v.file,
//           line: v.line
//         }));

//         const filesContext = Object.entries(fileContents)
//           .map(([path, content]) => `FILE: ${path}\n\`\`\`\n${content}\n\`\`\``)
//           .join('\n\n');

//         const prompt = `You are a code security auditor. Map these vulnerabilities to the exact files and line numbers.

// Vulnerabilities:
// ${JSON.stringify(vulnerabilitiesList, null, 2)}

// Files:
// ${filesContext}

// Return ONLY valid JSON with mappings.`;

//         const result = await this.model.generateContent(prompt);
//         const text = result.response.text().replace(/```json|```/g, '').trim();
        
//         try {
//           const parsed = JSON.parse(text);
//           Object.assign(mappings, parsed.mappings || {});
//         } catch (e) {}
//       }

//       // Save mappings to database
//       for (const [vulnId, mapping] of Object.entries(mappings)) {
//         const vuln = scan.vulnerabilities.id(vulnId);
//         if (vuln) {
//           vuln.file = mapping.file;
//           vuln.line = mapping.line.toString();
//         }
//       }
      
//       await scan.save();

//       res.json({ 
//         success: true, 
//         data: { 
//           mappings,
//           filesScanned: filePaths.length,
//           totalVulnerabilities: scan.vulnerabilities.length,
//           mappedCount: Object.keys(mappings).length
//         } 
//       });

//     } catch (error) {
//       console.error('Map Vulnerabilities Error:', error);
//       res.status(500).json({ success: false, message: 'Failed to map vulnerabilities' });
//     }
//   }

//   /**
//    * Detect programming language from code
//    */
//   detectLanguage(code) {
//     if (!code) return 'javascript';
    
//     const patterns = {
//       'javascript': /(?:const|let|var|function|\=>|import.*from|require\()/,
//       'typescript': /(?:interface|type\s+\w+\s*=|as\s+\w+|:\s*\w+\s*[=;])/,
//       'python': /(?:def\s+\w+|import\s+\w+|from\s+\w+\s+import|print\()/,
//       'java': /(?:public\s+class|private\s+|protected\s+|@Override)/,
//       'php': /<\?php/,
//       'cpp': /(?:#include|int\s+main|std::)/,
//       'csharp': /(?:using\s+System|namespace\s+\w+|class\s+\w+\s*:\s*)/,
//       'ruby': /(?:def\s+\w+|require\s+|class\s+\w+\s*<)/,
//       'go': /(?:func\s+\w+|package\s+main|import\s+\()/,
//       'rust': /(?:fn\s+\w+|let\s+mut|impl\s+)/,
//       'swift': /(?:func\s+\w+|var\s+\w+:\s*|import\s+Foundation)/,
//       'kotlin': /(?:fun\s+\w+|val\s+\w+|var\s+\w+)/
//     };

//     for (const [lang, pattern] of Object.entries(patterns)) {
//       if (pattern.test(code)) {
//         return lang;
//       }
//     }
    
//     return 'javascript';
//   }

//   /**
//    * Deduplicate vulnerabilities
//    */
//   deduplicateVulnerabilities(vulnerabilities) {
//     const uniqueMap = new Map();
    
//     vulnerabilities.forEach(vuln => {
//       const key = `${vuln.name}|${vuln.file || ''}|${vuln.line || ''}|${vuln.evidence?.substring(0, 50) || ''}`;
//       if (!uniqueMap.has(key)) uniqueMap.set(key, vuln);
//     });
    
//     return Array.from(uniqueMap.values());
//   }
// }

// module.exports = new AIController();















// src/controllers/aiController.js

const { GoogleGenerativeAI } = require('@google/generative-ai');
const Scan = require('../models/Scan');
const User = require('../models/User');
const { Octokit } = require('@octokit/rest');

class AIController {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.2,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    });
    
    this.REQUEST_TIMEOUT = 60000;
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

  /**
   * Explain vulnerability with AI
   */
  async explainVulnerability(req, res, next) {
    try {
      const { vulnerability } = req.body;
      
      const vulnName = typeof vulnerability === 'string' ? vulnerability : vulnerability?.name;
      const vulnSeverity = vulnerability?.severity || 'Unknown';
      const vulnDesc = vulnerability?.description || '';

      if (!vulnName) {
        return res.status(400).json({ 
          success: false, 
          message: 'Vulnerability name is required' 
        });
      }

      const prompt = `You are a cybersecurity expert. Explain this vulnerability concisely:

Vulnerability: ${vulnName}
Severity: ${vulnSeverity}
${vulnDesc ? `Description: ${vulnDesc}` : ''}

Return ONLY valid JSON in this exact format:
{
  "summary": "2-3 sentence explanation in simple terms",
  "impact": "Real-world security impact and risks",
  "exploitation": "How attackers could exploit this vulnerability"
}`;

      const resultPromise = this.model.generateContent(prompt);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), this.REQUEST_TIMEOUT)
      );

      const result = await Promise.race([resultPromise, timeoutPromise]);
      const text = result.response.text().replace(/```json|```/g, '').trim();
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = { 
          summary: text.substring(0, 500),
          impact: 'See summary above',
          exploitation: 'See summary above'
        };
      }

      const explanation = `${data.summary}\n\n**Impact:** ${data.impact}\n\n**How it's exploited:** ${data.exploitation}`;

      res.json({
        success: true,
        data: {
          vulnerability: vulnName,
          explanation
        }
      });
    } catch (error) {
      console.error('AI explain error:', error);
      
      if (error.message === 'Request timeout') {
        return res.status(504).json({ 
          success: false, 
          message: 'AI request timed out. Please try again.' 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        message: 'AI explanation service temporarily unavailable'
      });
    }
  }

  /**
   * ✅ FIXED: Generate secure code fix with ORIGINAL CODE and LINE NUMBER for patching
   */
  async generateFix(req, res, next) {
    try {
      let { vulnerability, codeContext, code, language, lineNumber, filePath, repoOwner, repoName, branch, scanId, vulnerabilityId } = req.body;

      let actualCode = codeContext || code;
      let fetchedFromGitHub = false;
      let originalFilePath = filePath;
      let originalFullContent = null;
      let exactLineNumber = lineNumber;

      // 🚀 Fetch real code from GitHub if details are present
      if (repoOwner && repoName && filePath && req.user) {
        console.log(`📡 Attempting to fetch code for fix: ${repoOwner}/${repoName}/${filePath} line ${lineNumber}`);
        try {
          const user = await User.findById(req.user.id).select('+githubAccessToken');
          const token = this.decryptToken(user.githubAccessToken);
          
          if (token) {
            const octokit = new Octokit({ auth: token });
            const { data } = await octokit.repos.getContent({
              owner: repoOwner,
              repo: repoName,
              path: filePath,
              ref: branch || 'main'
            });

            if (data.content) {
              originalFullContent = Buffer.from(data.content, 'base64').toString('utf-8');
              const lines = originalFullContent.split('\n');
              
              const targetLine = parseInt(lineNumber);
              
              if (!isNaN(targetLine) && targetLine > 0) {
                const lineIndex = targetLine - 1;
                const start = Math.max(0, lineIndex - 5);
                const end = Math.min(lines.length, lineIndex + 5);
                
                actualCode = lines.slice(start, end).join('\n');
                exactLineNumber = targetLine;
                console.log(`✅ Fetched ${end - start} lines of real code context from GitHub.`);
                fetchedFromGitHub = true;
              } else {
                actualCode = lines.slice(0, 50).join('\n');
                console.log(`⚠️ Invalid line number (${lineNumber}), used first 50 lines.`);
                fetchedFromGitHub = true;
              }
            }
          }
        } catch (fetchError) {
          console.error('❌ Failed to fetch real code from GitHub:', fetchError.message);
        }
      }

      const vulnName = typeof vulnerability === 'string' ? vulnerability : vulnerability?.name;
      const vulnSeverity = vulnerability?.severity || 'Unknown';
      const vulnDescription = vulnerability?.description || '';
      const vulnCategory = vulnerability?.category || '';

      if (!vulnName) {
        return res.status(400).json({ 
          success: false, 
          message: 'Vulnerability data required' 
        });
      }

      // If no code context is available, generate general advice
      if (!actualCode || actualCode.trim() === '') {
        return this.generateGeneralFix(req, res, { 
          name: vulnName, 
          severity: vulnSeverity,
          description: vulnDescription,
          category: vulnCategory
        });
      }

      const detectedLang = language || this.detectLanguage(actualCode) || 'javascript';

      const prompt = `You are a DevSecOps expert fixing a security vulnerability.

VULNERABILITY: ${vulnName}
SEVERITY: ${vulnSeverity}
DESCRIPTION: ${vulnDescription}
CATEGORY: ${vulnCategory}

FILE: ${filePath || 'unknown'}
LANGUAGE: ${detectedLang}
${exactLineNumber ? `LINE NUMBER TO FIX: ${exactLineNumber}` : ''}

VULNERABLE CODE SNIPPET (around line ${exactLineNumber || 'unknown'}):
\`\`\`${detectedLang}
${actualCode}
\`\`\`

INSTRUCTIONS:
1. Analyze the vulnerable code snippet above.
2. Generate ONLY the fixed code for the vulnerable lines.
3. DO NOT include the entire file - only the lines that need to be changed.
4. PRESERVE exact indentation and formatting.
5. ONLY change what's necessary to fix the vulnerability.
6. DO NOT add any explanatory comments like "// Fixed code:" or "// Solution:".
7. DO NOT wrap the code in markdown or backticks.

Return ONLY valid JSON:
{
  "isCodeFix": boolean,
  "fixedCode": "ONLY the fixed lines of code (not the entire file)",
  "explanation": "Brief explanation of what was changed and why (max 2 sentences)",
  "textSolution": "Detailed step-by-step remediation instructions (if isCodeFix is false)",
  "securityNotes": "Additional security best practices"
}`;

      const result = await this.model.generateContent(prompt);
      const text = result.response.text().replace(/```json|```/g, '').trim();
      
      let jsonResponse;
      try {
        jsonResponse = JSON.parse(text);
      } catch (e) {
        console.error('JSON parse error:', e);
        jsonResponse = { 
          isCodeFix: false, 
          explanation: 'Could not parse AI response',
          textSolution: text.substring(0, 1000)
        };
      }

      // Clean up fixedCode - remove any markdown or explanatory comments
      if (jsonResponse.fixedCode && jsonResponse.isCodeFix) {
        jsonResponse.fixedCode = jsonResponse.fixedCode
          .replace(/^```[\w]*\n?/g, '')
          .replace(/```$/g, '')
          .replace(/^\/\/ (Fixed|Secure|Solution|Proposed).*?\n/gm, '')
          .replace(/^#.*?\n/gm, '')
          .trim();
      }

      // ✅ CRITICAL: Get the exact vulnerable line for patching
      let vulnerableLine = '';
      if (originalFullContent && exactLineNumber) {
        const lines = originalFullContent.split('\n');
        vulnerableLine = lines[exactLineNumber - 1] || actualCode.split('\n')[0] || '';
      } else {
        vulnerableLine = actualCode.split('\n').find(line => line.trim().length > 0) || '';
      }

      const responseData = {
        vulnerability: vulnName,
        originalCode: vulnerableLine, // ✅ Send ONLY the vulnerable line for patching
        fullOriginalCode: originalFullContent, // ✅ Send full file for context
        fixedCode: jsonResponse.isCodeFix ? jsonResponse.fixedCode : null,
        explanation: jsonResponse.explanation || 'Security fix generated',
        textSolution: jsonResponse.isCodeFix ? null : (jsonResponse.textSolution || jsonResponse.explanation),
        securityNotes: jsonResponse.securityNotes,
        isCodeFix: jsonResponse.isCodeFix || false,
        language: detectedLang,
        lineNumber: exactLineNumber, // ✅ CRITICAL: Send exact line number for patching
        filePath: originalFilePath,
        fetchedFromGitHub: fetchedFromGitHub
      };

      // ✅ SAVE FIX TO DATABASE with original code and line number
      if (scanId && vulnerabilityId) {
        try {
          const scan = await Scan.findById(scanId);
          if (scan) {
            const vuln = scan.vulnerabilities.id(vulnerabilityId);
            if (vuln) {
              vuln.aiExplanation = responseData.explanation;
              vuln.aiFixedCode = responseData.fixedCode;
              vuln.originalCode = responseData.originalCode; // ✅ STORE ORIGINAL CODE
              vuln.aiBestPractices = responseData.securityNotes ? [responseData.securityNotes] : [];
              vuln.aiGeneratedAt = new Date();
              vuln.aiFixApplied = false;
              vuln.line = exactLineNumber?.toString() || vuln.line; // ✅ UPDATE LINE NUMBER
              
              await scan.save();
              console.log(`✅ Saved AI fix for vulnerability ${vulnerabilityId} at line ${exactLineNumber}`);
            }
          }
        } catch (saveError) {
          console.error('Failed to save AI fix:', saveError);
        }
      }

      res.json({
        success: true,
        data: responseData
      });

    } catch (error) {
      console.error('AI fix generation error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to generate fix',
        error: error.message
      });
    }
  }

  /**
   * Generate general fix recommendations
   */
  async generateGeneralFix(req, res, vulnerability) {
    try {
      const prompt = `You are a cybersecurity expert. Provide remediation guidance for this vulnerability:

Vulnerability: ${vulnerability.name}
Severity: ${vulnerability.severity || 'Unknown'}
${vulnerability.description ? `Description: ${vulnerability.description}` : ''}
${vulnerability.category ? `Category: ${vulnerability.category}` : ''}

Provide detailed step-by-step remediation instructions in JSON format:
{
  "isCodeFix": false,
  "explanation": "Brief overview of the vulnerability and remediation approach",
  "textSolution": "Detailed step-by-step remediation instructions with code examples if applicable",
  "securityNotes": "Additional security best practices and preventative measures"
}`;

      const result = await this.model.generateContent(prompt);
      const text = result.response.text().replace(/```json|```/g, '').trim();
      const data = JSON.parse(text);

      res.json({
        success: true,
        data: {
          vulnerability: vulnerability.name,
          isCodeFix: false,
          explanation: data.explanation,
          textSolution: data.textSolution,
          securityNotes: data.securityNotes,
          originalCode: null,
          fixedCode: null,
          lineNumber: null
        }
      });
    } catch (error) {
      console.error('General fix generation error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to generate fix recommendations' 
      });
    }
  }

  /**
   * Map vulnerabilities to files
   */
  async mapVulnerabilities(req, res) {
    try {
      const { scanId, repoOwner, repoName, filePaths, branch = 'main' } = req.body;
      const userId = req.user.id;

      if (!filePaths || filePaths.length === 0) {
        return res.status(400).json({ success: false, message: 'No files selected for mapping' });
      }

      const user = await User.findById(userId).select('+githubAccessToken');
      if (!user.githubAccessToken) {
        return res.status(403).json({ success: false, message: 'GitHub not connected' });
      }

      const scan = await Scan.findById(scanId);
      if (!scan) return res.status(404).json({ success: false, message: 'Scan not found' });

      // Gemini already provides file and line numbers
      const mappings = {};
      
      scan.vulnerabilities.forEach(vuln => {
        const vulnId = vuln._id || vuln.id;
        
        if (vuln.file && vuln.line) {
          const matchedFile = filePaths.find(p => 
            p === vuln.file || 
            p.endsWith(vuln.file) ||
            vuln.file.endsWith(p.split('/').pop())
          );
          
          if (matchedFile) {
            mappings[vulnId] = {
              file: vuln.file,
              line: parseInt(vuln.line),
              confidence: 'high',
              matchedBy: 'gemini-direct'
            };
          }
        }
      });

      res.json({ 
        success: true, 
        data: { 
          mappings,
          filesScanned: filePaths.length,
          totalVulnerabilities: scan.vulnerabilities.length,
          mappedCount: Object.keys(mappings).length
        } 
      });

    } catch (error) {
      console.error('Map Vulnerabilities Error:', error);
      res.status(500).json({ success: false, message: 'Failed to map vulnerabilities' });
    }
  }

  /**
   * Detect programming language from code
   */
  detectLanguage(code) {
    if (!code) return 'javascript';
    
    const patterns = {
      'javascript': /(?:const|let|var|function|\=>|import.*from|require\()/,
      'typescript': /(?:interface|type\s+\w+\s*=|as\s+\w+|:\s*\w+\s*[=;])/,
      'python': /(?:def\s+\w+|import\s+\w+|from\s+\w+\s+import|print\()/,
      'java': /(?:public\s+class|private\s+|protected\s+|@Override)/,
      'php': /<\?php/,
      'cpp': /(?:#include|int\s+main|std::)/,
      'csharp': /(?:using\s+System|namespace\s+\w+|class\s+\w+\s*:\s*)/,
      'ruby': /(?:def\s+\w+|require\s+|class\s+\w+\s*<)/,
      'go': /(?:func\s+\w+|package\s+main|import\s+\()/,
      'rust': /(?:fn\s+\w+|let\s+mut|impl\s+)/,
      'swift': /(?:func\s+\w+|var\s+\w+:\s*|import\s+Foundation)/,
      'kotlin': /(?:fun\s+\w+|val\s+\w+|var\s+\w+)/
    };

    for (const [lang, pattern] of Object.entries(patterns)) {
      if (pattern.test(code)) {
        return lang;
      }
    }
    
    return 'javascript';
  }

  /**
   * Deduplicate vulnerabilities
   */
  deduplicateVulnerabilities(vulnerabilities) {
    const uniqueMap = new Map();
    
    vulnerabilities.forEach(vuln => {
      const key = `${vuln.name}|${vuln.file || ''}|${vuln.line || ''}|${vuln.evidence?.substring(0, 50) || ''}`;
      if (!uniqueMap.has(key)) uniqueMap.set(key, vuln);
    });
    
    return Array.from(uniqueMap.values());
  }
}

module.exports = new AIController();