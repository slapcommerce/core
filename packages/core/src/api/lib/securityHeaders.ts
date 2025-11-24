/**
 * Security headers utility for HTTP responses
 * Implements security best practices to protect against common vulnerabilities
 */

export function getSecurityHeaders(nodeEnv?: string): Record<string, string> {
  const isProduction = (nodeEnv ?? process.env.NODE_ENV) === "production";
  
  const headers: Record<string, string> = {
    // Prevent clickjacking attacks
    'X-Frame-Options': 'DENY',
    
    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',
    
    // Control referrer information leakage
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    
    // Restrict browser features to prevent abuse
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    
    // Content Security Policy - restrict resource loading to prevent XSS
    // Allow same-origin resources, inline scripts/styles for React, and data URIs for images
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-eval needed for React dev mode
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  };

  // HSTS header - enforce HTTPS in production only
  if (isProduction) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
  }

  return headers;
}

