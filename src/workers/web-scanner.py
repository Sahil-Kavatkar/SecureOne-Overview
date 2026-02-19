# #!/usr/bin/env python3
# """
# SecureOne - Professional Web Security Scanner Worker
# Wraps OWASP ZAP API with context management, detailed reporting, and error resilience.
# Supports: Fast, Medium, Deep scans.
# """

# import sys
# import json
# import time
# import urllib.parse
# import os
# import traceback

# # ✅ FIX: Handle missing dependency gracefully
# try:
#     from zapv2 import ZAPv2
# except ImportError:
#     error_msg = {
#         "error": "Missing dependency 'zapv2'. Please run: pip3 install python-owasp-zap-v2.4",
#         "vulnerabilities": []
#     }
#     print(json.dumps(error_msg))
#     sys.exit(1)

# class WebScanner:
#     def __init__(self, target_url, scan_id, scan_depth='medium'):
#         self.target_url = target_url
#         self.scan_id = scan_id
#         self.scan_depth = scan_depth
        
#         # Get ZAP API Key from env or default to empty
#         self.zap_api_key = os.getenv('ZAP_API_KEY', '')
#         # Default ZAP proxy location
#         self.zap_proxy = {'http': 'http://127.0.0.1:8080', 'https': 'http://127.0.0.1:8080'}
        
#         # Connect to ZAP
#         self.zap = ZAPv2(apikey=self.zap_api_key, proxies=self.zap_proxy)
#         self.domain = urllib.parse.urlparse(target_url).netloc

#     def log(self, message, progress=None):
#         """Send formatted logs to Node.js"""
#         timestamp = time.strftime("%H:%M:%S")
#         if progress is not None:
#             print(f"PROGRESS:{progress} [{timestamp}] {message}", flush=True)
#         else:
#             print(f"[{timestamp}] {message}", flush=True)

#     def wait_for_scan(self, scanner_obj, scan_id, start_progress, end_progress, label):
#         """Generic wait function for ZAP async operations"""
#         while int(scanner_obj.status(scan_id)) < 100:
#             p = int(scanner_obj.status(scan_id))
#             # Map ZAP's 0-100% to our progress range
#             normalized = start_progress + (p * (end_progress - start_progress) / 100)
#             self.log(f"{label} progress: {p}%", int(normalized))
#             time.sleep(2)

#     def scan(self):
#         try:
#             self.log(f"🔥 Initializing SecureOne Scan ({self.scan_depth.upper()} mode) for: {self.target_url}", 1)

#             # Check if ZAP is actually running
#             try:
#                 self.zap.core.version
#             except Exception:
#                 raise Exception("Could not connect to OWASP ZAP on localhost:8080. Is ZAP running?")

#             # 1. Setup Context
#             self.log("⚙️  Configuring scan context...", 5)
#             context_name = f"Context_{self.scan_id}"
            
#             try:
#                 # Setup context if possible
#                 self.zap.context.new_context(context_name)
#                 self.zap.context.include_in_context(context_name, f"{self.target_url}.*")
#             except Exception as e:
#                 self.log(f"⚠️ Context setup warning: {str(e)}")

#             # 2. Access Target
#             self.log(f"📡 Accessing target: {self.target_url}", 8)
#             try:
#                 self.zap.urlopen(self.target_url)
#                 time.sleep(2)
#             except Exception as e:
#                  self.log(f"⚠️ Target access warning: {str(e)}")

#             # 3. Spider Scan
#             self.log("🕷️  Starting Spider...", 10)
#             spider_id = self.zap.spider.scan(self.target_url, contextname=context_name)
#             self.wait_for_scan(self.zap.spider, spider_id, 10, 30, "Spider")
#             self.log("✅ Spider complete", 30)

#             # 4. Active Scan (Skip if fast mode)
#             if self.scan_depth == 'fast':
#                 self.log("⏩ [FAST MODE] Skipping Active Scan", 80)
#             else:
#                 self.log(f"🎯 Starting Active Scan ({self.scan_depth.upper()})...", 40)
#                 self.zap.ascan.enable_all_scanners()
#                 scan_id = self.zap.ascan.scan(self.target_url, contextid=context_id)
#                 self.wait_for_scan(self.zap.ascan, scan_id, 40, 90, "Active Scan")
#                 self.log("✅ Active scan complete", 90)

#             # 5. Process Results
#             self.log("📊 Analyzing results...", 95)
#             alerts = self.zap.core.alerts(baseurl=self.target_url)
#             vulnerabilities = self.process_alerts(alerts)
            
#             report = {
#                 'scanId': self.scan_id,
#                 'target': self.target_url,
#                 'scanMode': self.scan_depth,
#                 'scanDate': time.strftime("%Y-%m-%d %H:%M:%S"),
#                 'vulnerabilities': vulnerabilities,
#                 'totalVulns': len(vulnerabilities),
#                 'summary': {
#                     'critical': len([v for v in vulnerabilities if v['severity'] == 'critical']),
#                     'high': len([v for v in vulnerabilities if v['severity'] == 'high']),
#                     'medium': len([v for v in vulnerabilities if v['severity'] == 'medium']),
#                     'low': len([v for v in vulnerabilities if v['severity'] == 'low']),
#                     'info': len([v for v in vulnerabilities if v['severity'] == 'info']),
#                 }
#             }
            
#             self.log(f"✅ Scan complete! Found {len(vulnerabilities)} vulnerabilities", 100)
#             print(json.dumps(report))
#             return 0

#         except Exception as e:
#             # Print to stderr for debugging
#             print(f"DEBUG: {traceback.format_exc()}", file=sys.stderr)
            
#             self.log(f"❌ FATAL ERROR: {str(e)}")
#             # Output JSON error so Node.js can parse it
#             error_report = {
#                 'error': str(e),
#                 'scanId': self.scan_id,
#                 'vulnerabilities': [],
#                 'totalVulns': 0
#             }
#             print(json.dumps(error_report))
#             return 1

#     def process_alerts(self, alerts):
#         vulnerabilities = []
#         severity_map = {'3': 'high', '2': 'medium', '1': 'low', '0': 'info'}

#         for alert in alerts:
#             name = alert.get('alert', 'Unknown')
#             risk_code = str(alert.get('risk', '0'))
#             severity = severity_map.get(risk_code, 'info')
            
#             if self.is_owasp_top10(name):
#                 severity = 'critical'
            
#             vuln = {
#                 'name': name,
#                 'severity': severity,
#                 'description': alert.get('description', ''),
#                 'solution': alert.get('solution', ''),
#                 'url': alert.get('url', ''),
#                 'evidence': alert.get('evidence', ''),
#                 'cweid': alert.get('cweid', ''),
#                 'category': self.categorize_vuln(name)
#             }
#             vulnerabilities.append(vuln)
        
#         # Sort by severity
#         severity_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3, 'info': 4}
#         vulnerabilities.sort(key=lambda x: severity_order.get(x['severity'], 5))
#         return vulnerabilities

#     def categorize_vuln(self, name):
#         name_lower = name.lower()
#         if any(x in name_lower for x in ['sql', 'injection', 'xss', 'csrf', 'xxe', 'auth']): return 'owasp'
#         if any(x in name_lower for x in ['error', '500', 'ssl', 'tls', 'certificate']): return 'broken'
#         return 'ui'

#     def is_owasp_top10(self, name):
#         name_lower = name.lower()
#         owasp_keywords = [
#             'sql injection', 'xss', 'cross-site scripting', 'csrf', 'xml external entity',
#             'broken authentication', 'sensitive data exposure', 'security misconfiguration'
#         ]
#         return any(x in name_lower for x in owasp_keywords)

# if __name__ == '__main__':
#     if len(sys.argv) < 3:
#         print(json.dumps({"error": "Missing arguments"}), file=sys.stderr)
#         sys.exit(1)
    
#     target_url = sys.argv[1]
#     scan_id = sys.argv[2]
#     scan_depth = sys.argv[3] if len(sys.argv) > 3 else 'medium'
    
#     scanner = WebScanner(target_url, scan_id, scan_depth)
#     exit_code = scanner.scan()
#     sys.exit(exit_code)












#!/usr/bin/env python3
"""
SecureOne - Professional Web Security Scanner Worker
Wraps OWASP ZAP API with FULL AUTHENTICATION SUPPORT
Supports: Fast, Medium, Deep scans with Form-based, JSON API, and Header-based auth
"""

import sys
import json
import time
import urllib.parse
import os
import traceback

# ✅ FIX: Handle missing dependency gracefully
try:
    from zapv2 import ZAPv2
except ImportError:
    error_msg = {
        "error": "Missing dependency 'zapv2'. Please run: pip3 install python-owasp-zap-v2.4",
        "vulnerabilities": []
    }
    print(json.dumps(error_msg))
    sys.exit(1)

class WebScanner:
    def __init__(self, target_url, scan_id, scan_depth='medium'):
        self.target_url = target_url
        self.scan_id = scan_id
        self.scan_depth = scan_depth
        
        # Get ZAP API Key from env or default to empty
        self.zap_api_key = os.getenv('ZAP_API_KEY', '')
        # Default ZAP proxy location
        self.zap_proxy = {'http': 'http://127.0.0.1:8080', 'https': 'http://127.0.0.1:8080'}
        
        # Connect to ZAP
        self.zap = ZAPv2(apikey=self.zap_api_key, proxies=self.zap_proxy)
        self.domain = urllib.parse.urlparse(target_url).netloc
        
        # ✅ CRITICAL FIX: Read authentication settings from environment variables
        self.auth_method = os.getenv('ZAP_AUTH_METHOD', 'none')
        self.auth_login_url = os.getenv('ZAP_LOGIN_URL', '')
        self.auth_username = os.getenv('ZAP_USERNAME', '')
        self.auth_password = os.getenv('ZAP_PASSWORD', '')
        self.auth_username_field = os.getenv('ZAP_USERNAME_FIELD', 'username')
        self.auth_password_field = os.getenv('ZAP_PASSWORD_FIELD', 'password')
        self.auth_token_header = os.getenv('ZAP_TOKEN_HEADER', 'Authorization')
        self.auth_token_value = os.getenv('ZAP_TOKEN_VALUE', '')
        self.auth_logged_in_pattern = os.getenv('ZAP_LOGGED_IN_PATTERN', 'logout|dashboard|profile|welcome|account')
        self.auth_logged_out_pattern = os.getenv('ZAP_LOGGED_OUT_PATTERN', 'login|signin|auth|unauthorized')
        
        # Log auth status
        if self.auth_method != 'none':
            print(f"[DEBUG] Authentication enabled: {self.auth_method}", file=sys.stderr)
            if self.auth_username:
                print(f"[DEBUG] Username: {self.auth_username}", file=sys.stderr)

    def log(self, message, progress=None, is_error=False):
        """Send formatted logs to Node.js"""
        timestamp = time.strftime("%H:%M:%S")
        prefix = "❌ ERROR:" if is_error else ""
        if progress is not None:
            print(f"PROGRESS:{progress} [{timestamp}] {prefix} {message}", flush=True)
        else:
            print(f"[{timestamp}] {prefix} {message}", flush=True)

    def wait_for_scan(self, scanner_obj, scan_id, start_progress, end_progress, label):
        """Generic wait function for ZAP async operations"""
        try:
            while int(scanner_obj.status(scan_id)) < 100:
                p = int(scanner_obj.status(scan_id))
                # Map ZAP's 0-100% to our progress range
                normalized = start_progress + (p * (end_progress - start_progress) / 100)
                self.log(f"{label} progress: {p}%", int(normalized))
                time.sleep(2)
        except Exception as e:
            self.log(f"⚠️ Error checking {label} progress: {str(e)}", is_error=True)

    def setup_authentication(self, context_id, context_name):
        """Configure authentication in ZAP"""
        if self.auth_method == 'none' or not self.auth_login_url:
            self.log("🔓 No authentication configured - scanning public pages only", 12)
            return False

        try:
            self.log(f"🔐 Configuring {self.auth_method.upper()} authentication...", 12)
            
            if self.auth_method == 'form':
                # Form-based authentication
                auth_config = f"loginUrl={self.auth_login_url}&loginRequestData={self.auth_username_field}={{{self.auth_username_field}}}&{self.auth_password_field}={{{self.auth_password_field}}}"
                self.zap.authentication.set_method(
                    contextid=context_id,
                    methodname='formBasedAuthentication',
                    authconfig=auth_config
                )
                
                # Set login indicators
                if self.auth_logged_in_pattern:
                    self.zap.authentication.set_logged_in_indicator(
                        contextid=context_id,
                        loggedinindicator=r'\b(' + self.auth_logged_in_pattern + r')\b'
                    )
                if self.auth_logged_out_pattern:
                    self.zap.authentication.set_logged_out_indicator(
                        contextid=context_id,
                        loggedoutindicator=r'\b(' + self.auth_logged_out_pattern + r')\b'
                    )
                
                self.log("✅ Form-based authentication configured", 13)
                
            elif self.auth_method == 'json':
                # JSON API authentication
                auth_config = f"loginUrl={self.auth_login_url}&loginRequestData={{\"{self.auth_username_field}\":\"{{{self.auth_username_field}}}\",\"{self.auth_password_field}\":\"{{{self.auth_password_field}}}\"}}"
                self.zap.authentication.set_method(
                    contextid=context_id,
                    methodname='jsonBasedAuthentication',
                    authconfig=auth_config
                )
                self.log("✅ JSON API authentication configured", 13)
                
            elif self.auth_method == 'header':
                # Header-based authentication (Bearer token, Basic auth, etc.)
                auth_config = f"header={self.auth_token_header}&headerValue={{{self.auth_token_value}}}"
                self.zap.authentication.set_method(
                    contextid=context_id,
                    methodname='headerBasedAuthentication',
                    authconfig=auth_config
                )
                self.log(f"✅ Header-based authentication configured ({self.auth_token_header})", 13)
            
            # Add users
            if self.auth_username and self.auth_password:
                user_id = self.zap.users.new_user(contextid=context_id, name=f"user_{self.auth_username}")
                self.zap.users.set_authentication_credentials(
                    contextid=context_id,
                    userid=user_id,
                    authcredentials=f"username={self.auth_username}&password={self.auth_password}"
                )
                self.zap.users.set_user_enabled(contextid=context_id, userid=user_id, enabled=True)
                
                # Enable forced user mode
                self.zap.forcedUser.set_forced_user(contextid=context_id, userid=user_id)
                self.zap.forcedUser.set_forced_user_mode_enabled(boolean=True)
                
                self.log(f"✅ User '{self.auth_username}' configured and enabled", 14)
                return True
            else:
                self.log("⚠️ Username or password missing for authentication", is_error=True)
                return False
            
        except Exception as e:
            self.log(f"⚠️ Authentication setup failed: {str(e)}", is_error=True)
            self.log("📝 Continuing with unauthenticated scan...", 12)
            return False

    def get_spider_depth(self):
        """Get spider max children based on scan depth"""
        depths = {
            'fast': 10,
            'medium': 50,
            'deep': 200
        }
        return depths.get(self.scan_depth, 50)

    def scan(self):
        try:
            self.log(f"🔥 Initializing SecureOne Scan ({self.scan_depth.upper()} mode) for: {self.target_url}", 1)

            # Check if ZAP is actually running
            try:
                version = self.zap.core.version
                self.log(f"✅ Connected to ZAP version: {version}", 2)
            except Exception as e:
                raise Exception(f"Could not connect to OWASP ZAP on localhost:8080. Is ZAP running? Error: {str(e)}")

            # 1. Setup Context with Authentication
            self.log("⚙️  Configuring scan context...", 5)
            context_name = f"Context_{self.scan_id}"
            context_id = self.zap.context.new_context(context_name)
            
            # Include target in context
            self.zap.context.include_in_context(context_name, f"{self.target_url}.*")
            self.log(f"✅ Context created: {context_name}", 6)
            
            # ✅ Setup authentication if configured
            auth_enabled = self.setup_authentication(context_id, context_name)

            # 2. Access Target
            self.log(f"📡 Accessing target: {self.target_url}", 8)
            try:
                self.zap.urlopen(self.target_url)
                time.sleep(2)
                self.log("✅ Target accessible", 9)
            except Exception as e:
                self.log(f"⚠️ Target access warning: {str(e)}")

            # 3. Spider Scan
            self.log("🕷️  Starting Spider...", 10)
            
            if auth_enabled and self.auth_username:
                # Use authenticated spider
                user_id = self.zap.users.get_user_id(contextid=context_id, name=f"user_{self.auth_username}")
                spider_id = self.zap.spider.scan_as_user(
                    contextid=context_id,
                    userid=user_id,
                    url=self.target_url,
                    maxchildren=self.get_spider_depth(),
                    recurse=True
                )
                self.log("🔐 Spider running with authentication", 11)
            else:
                spider_id = self.zap.spider.scan(self.target_url, contextname=context_name, maxchildren=self.get_spider_depth(), recurse=True)
            
            self.wait_for_scan(self.zap.spider, spider_id, 10, 30, "Spider")
            self.log("✅ Spider complete", 30)
            
            # Log spider results
            spider_results = self.zap.spider.results(spider_id)
            self.log(f"📊 Spider found {len(spider_results)} URLs", 31)

            # 4. AJAX Spider for dynamic content (DEEP mode)
            if self.scan_depth == 'deep':
                self.log("⚡ [DEEP MODE] Starting AJAX Spider (Headless Browser)...", 32)
                try:
                    if auth_enabled and self.auth_username:
                        self.zap.ajaxSpider.scan_as_user(
                            contextname=context_name,
                            username=self.auth_username,
                            url=self.target_url
                        )
                    else:
                        self.zap.ajaxSpider.scan(self.target_url, contextname=context_name)
                    
                    # Wait for AJAX spider to complete
                    timeout = 120
                    while self.zap.ajaxSpider.status == 'running' and timeout > 0:
                        self.log(f"🔄 AJAX Spider running... ({len(self.zap.ajaxSpider.results)} URLs found)", 35)
                        time.sleep(5)
                        timeout -= 5
                    
                    self.log("✅ AJAX Spider complete", 40)
                except Exception as e:
                    self.log(f"⚠️ AJAX Spider failed (skipping): {str(e)}")
            else:
                self.log("⏩ Skipping AJAX Spider (Medium/Fast mode)", 35)

            # 5. Active Scan (Skip if fast mode)
            if self.scan_depth == 'fast':
                self.log("⏩ [FAST MODE] Skipping Active Scan", 80)
            else:
                self.log(f"🎯 Starting Active Scan ({self.scan_depth.upper()})...", 45)
                
                # Enable all scanners
                self.zap.ascan.enable_all_scanners()
                
                # Configure scan policy based on depth
                if self.scan_depth == 'deep':
                    self.zap.ascan.set_scanner_alert_threshold(id='all', alertthreshold='low')
                    self.zap.ascan.set_scanner_attack_strength(id='all', attackstrength='high')
                
                # Start active scan
                if auth_enabled and self.auth_username:
                    user_id = self.zap.users.get_user_id(contextid=context_id, name=f"user_{self.auth_username}")
                    scan_id = self.zap.ascan.scan_as_user(
                        url=self.target_url,
                        contextid=context_id,
                        userid=user_id,
                        recurse=True,
                        inscopeonly=False
                    )
                else:
                    scan_id = self.zap.ascan.scan(
                        self.target_url,
                        contextid=context_id,
                        recurse=(self.scan_depth == 'deep'),
                        inscopeonly=False
                    )
                
                self.wait_for_scan(self.zap.ascan, scan_id, 45, 90, "Active Scan")
                self.log("✅ Active scan complete", 90)

            # 6. Process Results
            self.log("📊 Analyzing results...", 95)
            
            # Get all alerts for the target
            alerts = self.zap.core.alerts(baseurl=self.target_url)
            
            # Also get alerts from discovered URLs
            spider_urls = self.zap.spider.results(spider_id)
            for url in spider_urls[:100]:  # Limit to 100 URLs
                url_alerts = self.zap.core.alerts(baseurl=url)
                alerts.extend(url_alerts)
            
            # Remove duplicates
            unique_alerts = []
            seen = set()
            for alert in alerts:
                key = f"{alert.get('url', '')}_{alert.get('alert', '')}_{alert.get('evidence', '')}"
                if key not in seen:
                    seen.add(key)
                    unique_alerts.append(alert)
            
            vulnerabilities = self.process_alerts(unique_alerts)
            
            report = {
                'scanId': self.scan_id,
                'target': self.target_url,
                'scanMode': self.scan_depth,
                'scanDate': time.strftime("%Y-%m-%d %H:%M:%S"),
                'vulnerabilities': vulnerabilities,
                'totalVulns': len(vulnerabilities),
                'urlsScanned': len(spider_results),
                'authEnabled': auth_enabled,
                'authMethod': self.auth_method if auth_enabled else 'none',
                'summary': {
                    'critical': len([v for v in vulnerabilities if v['severity'] == 'critical']),
                    'high': len([v for v in vulnerabilities if v['severity'] == 'high']),
                    'medium': len([v for v in vulnerabilities if v['severity'] == 'medium']),
                    'low': len([v for v in vulnerabilities if v['severity'] == 'low']),
                    'info': len([v for v in vulnerabilities if v['severity'] == 'info']),
                }
            }
            
            self.log(f"✅ Scan complete! Found {len(vulnerabilities)} vulnerabilities across {len(spider_results)} URLs", 100)
            print(json.dumps(report))
            return 0

        except Exception as e:
            print(f"DEBUG: {traceback.format_exc()}", file=sys.stderr)
            self.log(f"❌ FATAL ERROR: {str(e)}", is_error=True)
            error_report = {
                'error': str(e),
                'scanId': self.scan_id,
                'vulnerabilities': [],
                'totalVulns': 0,
                'urlsScanned': 0,
                'authEnabled': self.auth_method != 'none',
                'authMethod': self.auth_method
            }
            print(json.dumps(error_report))
            return 1

    def process_alerts(self, alerts):
        vulnerabilities = []
        severity_map = {'3': 'high', '2': 'medium', '1': 'low', '0': 'info'}

        for alert in alerts:
            name = alert.get('alert', 'Unknown')
            risk_code = str(alert.get('risk', '0'))
            severity = severity_map.get(risk_code, 'info')
            
            if self.is_owasp_top10(name):
                severity = 'critical'
            
            vuln = {
                'name': name,
                'severity': severity,
                'description': alert.get('description', ''),
                'solution': alert.get('solution', ''),
                'url': alert.get('url', ''),
                'evidence': alert.get('evidence', ''),
                'cweid': alert.get('cweid', ''),
                'category': self.categorize_vuln(name),
                'method': alert.get('method', ''),
                'param': alert.get('param', ''),
                'attack': alert.get('attack', ''),
                'reference': alert.get('reference', '')
            }
            vulnerabilities.append(vuln)
        
        # Sort by severity
        severity_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3, 'info': 4}
        vulnerabilities.sort(key=lambda x: severity_order.get(x['severity'], 5))
        return vulnerabilities

    def categorize_vuln(self, name):
        name_lower = name.lower()
        if any(x in name_lower for x in ['sql', 'injection', 'xss', 'csrf', 'xxe', 'auth']): 
            return 'owasp'
        if any(x in name_lower for x in ['error', '500', 'ssl', 'tls', 'certificate']): 
            return 'broken'
        if any(x in name_lower for x in ['cors', 'header', 'cookie', 'session']): 
            return 'configuration'
        return 'ui'

    def is_owasp_top10(self, name):
        name_lower = name.lower()
        owasp_keywords = [
            'sql injection', 'xss', 'cross-site scripting', 'csrf', 'xml external entity',
            'broken authentication', 'sensitive data exposure', 'security misconfiguration',
            'broken access control', 'insecure deserialization', 'xxe', 'ssrf'
        ]
        return any(x in name_lower for x in owasp_keywords)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Missing arguments"}), file=sys.stderr)
        sys.exit(1)
    
    target_url = sys.argv[1]
    scan_id = sys.argv[2]
    scan_depth = sys.argv[3] if len(sys.argv) > 3 else 'medium'
    
    scanner = WebScanner(target_url, scan_id, scan_depth)
    exit_code = scanner.scan()
    sys.exit(exit_code)