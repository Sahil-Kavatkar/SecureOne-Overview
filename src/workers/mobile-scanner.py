#!/usr/bin/env python3
"""
SecureOne - Mobile Security Scanner Worker
Uses MobSF Docker container for Android APK security analysis
Docker: opensecurity/mobile-security-framework-mobsf:latest
"""

import sys
import json
import time
import requests
import os
import warnings
import traceback

# Suppress the LibreSSL warning from urllib3 - it's harmless on macOS
warnings.filterwarnings("ignore", category=UserWarning, module='urllib3')
warnings.filterwarnings("ignore", category=DeprecationWarning)

# Try to import requests_toolbelt, fallback to simple multipart if not available
try:
    from requests_toolbelt.multipart.encoder import MultipartEncoder
    HAS_TOOLBELT = True
except ImportError:
    HAS_TOOLBELT = False

class MobileScanner:
    def __init__(self, apk_path, scan_id):
        self.apk_path = apk_path
        self.scan_id = scan_id
        # MobSF Docker default URL
        self.mobsf_url = os.getenv('MOBSF_API_URL', 'http://localhost:8000')
        self.api_key = os.getenv('MOBSF_API_KEY', '')
        
        # Disable SSL warnings if using self-signed certs
        requests.packages.urllib3.disable_warnings()

    def log(self, message, progress=None, is_error=False):
        """Send log to Node.js via stdout - CRITICAL for live terminal"""
        timestamp = time.strftime("%H:%M:%S")
        prefix = "❌ ERROR:" if is_error else ""
        
        if progress is not None:
            print(f"PROGRESS:{progress} [{timestamp}] {prefix} {message}", flush=True)
        else:
            print(f"[{timestamp}] {prefix} {message}", flush=True)

    def scan(self):
        """Execute mobile security scan using MobSF Docker"""
        try:
            self.log("📱 Starting mobile security analysis with MobSF Docker...", 5)
            
            # 1. Check if MobSF is reachable
            try:
                health_check = requests.get(f"{self.mobsf_url}/api/v1/health", timeout=5, verify=False)
                if health_check.status_code != 200:
                    self.log("⚠️ MobSF health check failed, but continuing...", 7)
            except Exception as e:
                self.log(f"⚠️ Cannot connect to MobSF: {str(e)}", 7, True)
                self.log("🔧 Make sure MobSF Docker is running: docker run -it -p 8000:8000 opensecurity/mobile-security-framework-mobsf:latest", 7)
            
            # 2. Upload APK
            self.log(f"📤 Uploading APK to MobSF Docker...", 10)
            upload_response = self.upload_apk()
            
            if not upload_response:
                raise Exception("Upload failed - no response from MobSF")
            
            self.log(f"✅ APK uploaded successfully", 20)
            
            # 3. Get or generate file hash
            file_hash = None
            if isinstance(upload_response, dict):
                file_hash = upload_response.get('hash')
                if not file_hash:
                    file_hash = upload_response.get('scan_hash') or upload_response.get('hash_id')
            
            if not file_hash:
                raise Exception(f"Upload failed - no hash in response: {upload_response}")
            
            self.log(f"🔑 Scan hash: {file_hash[:8]}...", 25)
            
            # 4. Start analysis or get cached results
            self.log("🔍 Fetching scan results from MobSF...", 30)
            analysis_response = self.analyze_apk(file_hash)
            
            if not analysis_response:
                raise Exception("Analysis failed - no response from MobSF")
            
            self.log("✅ Analysis data retrieved successfully", 80)
            
            # 5. Process results - HANDLE FAILED SCANS GRACEFULLY
            self.log("📋 Processing vulnerability data...", 90)
            vulnerabilities = self.process_results(analysis_response)
            
            # 6. Check if scan actually succeeded
            scan_failed = False
            error_messages = []
            
            # Look for common failure indicators
            if isinstance(analysis_response, dict):
                if analysis_response.get('status') == 'failed':
                    scan_failed = True
                    error_messages.append(analysis_response.get('error', 'Scan failed'))
                
                # Check if manifest is missing (critical failure)
                if not analysis_response.get('manifest_analysis'):
                    self.log("⚠️ No manifest analysis results - APK may be corrupted or encrypted", 85, True)
                    error_messages.append("APK manifest could not be parsed - file may be corrupted or encrypted")
                
                # Check if app name is missing
                if not analysis_response.get('app_name'):
                    self.log("⚠️ Could not extract app name - APK may be obfuscated", 85, True)
            
            # 7. Generate report - ALWAYS return something, even on failure
            report = {
                'scanId': self.scan_id,
                'apkPath': self.apk_path,
                'fileHash': file_hash,
                'vulnerabilities': vulnerabilities,
                'totalVulns': len(vulnerabilities),
                'appInfo': {
                    'appName': self._safe_get(analysis_response, 'app_name', 'Unknown'),
                    'packageName': self._safe_get(analysis_response, 'package_name', 'Unknown'),
                    'version': self._safe_get(analysis_response, 'version_name', 'Unknown'),
                    'minSdk': self._safe_get(analysis_response, 'min_sdk', 'Unknown'),
                    'targetSdk': self._safe_get(analysis_response, 'target_sdk', 'Unknown'),
                    'icon': self._safe_get(analysis_response, 'icon_path', ''),
                    'size': self._safe_get(analysis_response, 'size', ''),
                    'md5': self._safe_get(analysis_response, 'md5', ''),
                    'sha1': self._safe_get(analysis_response, 'sha1', ''),
                    'sha256': self._safe_get(analysis_response, 'sha256', '')
                },
                'permissions': self._safe_get(analysis_response, 'permissions', {}),
                'securityScore': self.calculate_security_score(analysis_response),
                'scanner': 'MobSF Docker',
                'cached': self._safe_get(analysis_response, 'cached', False),
                'scanFailed': scan_failed,
                'errors': error_messages
            }
            
            # Log summary
            critical = len([v for v in vulnerabilities if v['severity'] == 'critical'])
            high = len([v for v in vulnerabilities if v['severity'] == 'high'])
            medium = len([v for v in vulnerabilities if v['severity'] == 'medium'])
            
            if scan_failed:
                self.log(f"⚠️ Scan completed with errors: {', '.join(error_messages)}", 95, True)
            else:
                self.log(f"✅ Found {len(vulnerabilities)} vulnerabilities: 🔴 {critical} Critical, 🟠 {high} High, 🟡 {medium} Medium", 95)
            
            self.log("✅ Mobile scan completed!", 100)
            
            # CRITICAL: Flush the JSON output
            print(json.dumps(report), flush=True)
            return 0 if not scan_failed else 1
            
        except Exception as e:
            error_msg = str(e)
            self.log(f"❌ Scan failed: {error_msg}", is_error=True)
            
            # Print full traceback for debugging
            traceback.print_exc(file=sys.stderr)
            
            # Always return a valid JSON report even on catastrophic failure
            error_report = {
                'error': error_msg,
                'scanId': self.scan_id,
                'vulnerabilities': [],
                'totalVulns': 0,
                'appInfo': {
                    'appName': 'Unknown',
                    'packageName': 'Unknown',
                    'version': 'Unknown',
                    'minSdk': 'Unknown',
                    'targetSdk': 'Unknown',
                    'size': self._get_file_size_mb(),
                    'md5': '',
                    'sha1': '',
                    'sha256': ''
                },
                'permissions': {},
                'securityScore': 0,
                'scanner': 'MobSF Docker',
                'cached': False,
                'scanFailed': True,
                'errors': [error_msg]
            }
            print(json.dumps(error_report), flush=True)
            return 1
    
    def _get_file_size_mb(self):
        """Get file size in MB"""
        try:
            size_bytes = os.path.getsize(self.apk_path)
            return f"{size_bytes / (1024 * 1024):.2f}MB"
        except:
            return "Unknown"
    
    def _safe_get(self, obj, key, default=None):
        """Safely get value from dict or return default"""
        if isinstance(obj, dict):
            return obj.get(key, default)
        return default
    
    def upload_apk(self):
        """Upload APK to MobSF Docker container"""
        url = f"{self.mobsf_url}/api/v1/upload"
        
        real_filename = os.path.basename(self.apk_path)
        if not real_filename.lower().endswith('.apk'):
            upload_filename = f"{real_filename}.apk"
        else:
            upload_filename = real_filename
        
        mime_type = 'application/vnd.android.package-archive'
        
        # Try with requests_toolbelt first
        if HAS_TOOLBELT:
            try:
                with open(self.apk_path, 'rb') as f:
                    multipart_data = MultipartEncoder(
                        fields={
                            'file': (upload_filename, f, mime_type)
                        }
                    )
                    
                    headers = {
                        'Content-Type': multipart_data.content_type,
                    }
                    if self.api_key:
                        headers['Authorization'] = self.api_key
                    
                    response = requests.post(url, data=multipart_data, headers=headers, timeout=120, verify=False)
                    
                    if response.status_code == 200:
                        try:
                            return response.json()
                        except:
                            return response.text
            except Exception as e:
                self.log(f"⚠️ Toolbelt upload failed: {str(e)}", is_error=True)
        
        # Fallback: Use simple multipart/form-data
        try:
            with open(self.apk_path, 'rb') as f:
                files = {
                    'file': (upload_filename, f, mime_type)
                }
                headers = {}
                if self.api_key:
                    headers['Authorization'] = self.api_key
                
                response = requests.post(url, files=files, headers=headers, timeout=120, verify=False)
                
                if response.status_code == 200:
                    try:
                        return response.json()
                    except:
                        return response.text
                
                raise Exception(f"Upload failed with status {response.status_code}")
                
        except requests.exceptions.RequestException as e:
            raise Exception(f"Connection to MobSF Docker failed: {str(e)}")
    
    def analyze_apk(self, file_hash):
        """Trigger analysis in MobSF Docker or get cached results"""
        url = f"{self.mobsf_url}/api/v1/scan"
        data = {'hash': file_hash}
        headers = {}
        if self.api_key:
            headers['Authorization'] = self.api_key
        
        try:
            self.log(f"⏳ Waiting for MobSF to analyze APK...", 40)
            response = requests.post(url, data=data, headers=headers, timeout=300, verify=False)
            
            if response.status_code == 200:
                try:
                    result = response.json()
                    # Check if this is cached response
                    if isinstance(result, dict) and result.get('cached'):
                        self.log(f"📦 Using cached analysis results", 70)
                    return result
                except json.JSONDecodeError:
                    return response.text
            else:
                raise Exception(f"Analysis failed with status {response.status_code}")
                
        except requests.exceptions.Timeout:
            raise Exception("MobSF analysis timed out after 5 minutes - APK may be too large or corrupted")
        except requests.exceptions.RequestException as e:
            raise Exception(f"Connection to MobSF Docker failed during analysis: {str(e)}")
    
    def process_results(self, analysis_data):
        """Convert MobSF results to SecureOne format - HANDLES FAILED SCANS"""
        vulnerabilities = []
        
        if not isinstance(analysis_data, dict):
            self.log(f"⚠️ Analysis data is not a dictionary: {type(analysis_data)}", is_error=True)
            return vulnerabilities
        
        # Check for scan failures
        if analysis_data.get('status') == 'failed':
            self.log(f"❌ MobSF scan failed: {analysis_data.get('error', 'Unknown error')}", is_error=True)
            
            # Create a vulnerability for the scan failure itself
            vulnerabilities.append({
                'name': 'MobSF Analysis Failed',
                'severity': 'high',
                'description': f"MobSF was unable to analyze this APK. Error: {analysis_data.get('error', 'Unknown error')}",
                'solution': 'The APK may be corrupted, encrypted, or obfuscated. Try with a different APK file.',
                'category': 'scan-error',
                'file': 'N/A',
                'line': 0,
                'evidence': 'Scan failed',
                'detectedBy': 'mobsf-docker',
                'cwe': '',
                'reference': ''
            })
            return vulnerabilities
        
        # Process Manifest Analysis (if available)
        manifest_analysis = analysis_data.get('manifest_analysis', [])
        if not manifest_analysis:
            self.log("⚠️ No manifest analysis available - APK may be corrupted", is_error=True)
        
        if isinstance(manifest_analysis, list):
            for item in manifest_analysis:
                if isinstance(item, dict):
                    severity = self.map_severity(item.get('stat', 'info'))
                    if severity in ['critical', 'high', 'medium']:
                        vuln = {
                            'name': item.get('title', 'Manifest Issue'),
                            'severity': severity,
                            'description': item.get('desc', 'No description available'),
                            'solution': item.get('solution', 'No solution provided'),
                            'category': 'manifest',
                            'evidence': item.get('name', ''),
                            'file': 'AndroidManifest.xml',
                            'line': item.get('line', 0),
                            'detectedBy': 'mobsf-docker',
                            'cwe': item.get('cwe', ''),
                            'reference': item.get('ref', '')
                        }
                        vulnerabilities.append(vuln)
        
        # Process Code Analysis (if available)
        code_analysis = analysis_data.get('code_analysis', {})
        if isinstance(code_analysis, dict):
            for category, findings in code_analysis.items():
                if isinstance(findings, list):
                    for finding in findings:
                        if isinstance(finding, dict):
                            metadata = finding.get('metadata', {})
                            if isinstance(metadata, dict):
                                severity = self.map_severity(metadata.get('severity', 'info'))
                                if severity in ['critical', 'high', 'medium']:
                                    vuln = {
                                        'name': category.replace('_', ' ').title(),
                                        'severity': severity,
                                        'description': metadata.get('description', 'No description available'),
                                        'solution': metadata.get('solution', 'No solution provided'),
                                        'category': 'code',
                                        'file': finding.get('path', ''),
                                        'line': finding.get('line_number', 0),
                                        'evidence': f"Ref: {metadata.get('ref', '')}",
                                        'detectedBy': 'mobsf-docker',
                                        'cwe': metadata.get('cwe', ''),
                                        'reference': metadata.get('ref', '')
                                    }
                                    vulnerabilities.append(vuln)
        
        # Process Network Security (if available)
        network_security = analysis_data.get('network_security', {})
        if isinstance(network_security, dict):
            for issue in network_security.get('issues', []):
                if isinstance(issue, dict):
                    severity = self.map_severity(issue.get('severity', 'info'))
                    if severity in ['critical', 'high', 'medium']:
                        vuln = {
                            'name': issue.get('title', 'Network Security Issue'),
                            'severity': severity,
                            'description': issue.get('description', 'No description available'),
                            'solution': issue.get('recommendation', 'No solution provided'),
                            'category': 'network',
                            'evidence': issue.get('evidence', ''),
                            'detectedBy': 'mobsf-docker',
                            'file': issue.get('file', ''),
                            'line': issue.get('line', 0)
                        }
                        vulnerabilities.append(vuln)
        
        # Sort by severity
        severity_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3, 'info': 4}
        vulnerabilities.sort(key=lambda x: severity_order.get(x['severity'], 5))
        
        return vulnerabilities
    
    def map_severity(self, mobsf_severity):
        """Map MobSF severity to SecureOne severity"""
        if not mobsf_severity:
            return 'info'
        
        mobsf_severity = str(mobsf_severity).lower()
        
        mapping = {
            'critical': 'critical',
            'high': 'high',
            'warning': 'medium',
            'medium': 'medium',
            'moderate': 'medium',
            'low': 'low',
            'info': 'info',
            'secure': 'info',
            'good': 'info',
            'pass': 'info'
        }
        
        return mapping.get(mobsf_severity, 'info')
    
    def calculate_security_score(self, analysis_data):
        """Calculate security score from MobSF results"""
        if not isinstance(analysis_data, dict):
            return 0
        
        # If scan failed, score is 0
        if analysis_data.get('status') == 'failed':
            return 0
        
        if 'security_score' in analysis_data:
            try:
                return int(analysis_data['security_score'])
            except:
                pass
        
        # Calculate score based on vulnerabilities
        score = 100
        vuln_count = 0
        
        # Manifest issues
        for item in analysis_data.get('manifest_analysis', []):
            if isinstance(item, dict):
                severity = self.map_severity(item.get('stat', 'info'))
                if severity == 'critical':
                    score -= 20
                    vuln_count += 1
                elif severity == 'high':
                    score -= 15
                    vuln_count += 1
                elif severity == 'medium':
                    score -= 10
                    vuln_count += 1
        
        # Code issues
        for category, findings in analysis_data.get('code_analysis', {}).items():
            if isinstance(findings, list):
                for finding in findings:
                    if isinstance(finding, dict):
                        metadata = finding.get('metadata', {})
                        if isinstance(metadata, dict):
                            severity = self.map_severity(metadata.get('severity', 'info'))
                            if severity == 'critical':
                                score -= 15
                                vuln_count += 1
                            elif severity == 'high':
                                score -= 10
                                vuln_count += 1
                            elif severity == 'medium':
                                score -= 5
                                vuln_count += 1
        
        # If no vulnerabilities but scan failed, score 0
        if vuln_count == 0 and analysis_data.get('status') == 'failed':
            return 0
            
        return max(0, min(100, score))

def main():
    if len(sys.argv) < 3:
        error_report = {
            'error': 'Missing arguments. Usage: python mobile-scanner.py <apk_path> <scan_id>',
            'vulnerabilities': [],
            'totalVulns': 0,
            'scanFailed': True,
            'errors': ['Missing arguments']
        }
        print(json.dumps(error_report), flush=True)
        sys.exit(1)
    
    apk_path = sys.argv[1]
    scan_id = sys.argv[2]
    
    if not os.path.exists(apk_path):
        error_report = {
            'error': f"APK file not found: {apk_path}",
            'vulnerabilities': [],
            'totalVulns': 0,
            'scanFailed': True,
            'errors': [f"APK file not found: {apk_path}"]
        }
        print(json.dumps(error_report), flush=True)
        sys.exit(1)
    
    # Check file size
    file_size = os.path.getsize(apk_path) / (1024 * 1024)
    if file_size > 100:
        print(f"⚠️ Warning: APK size is {file_size:.2f}MB - this may take longer to process", flush=True)
    
    scanner = MobileScanner(apk_path, scan_id)
    exit_code = scanner.scan()
    sys.exit(exit_code)

if __name__ == '__main__':
    main()