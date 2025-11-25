/**
 * Error sanitization utility
 * Prevents sensitive information leakage in production error responses
 */

import { ZodError } from "zod";

/**
 * Format Zod validation errors into user-friendly messages
 */
function formatZodError(error: ZodError): string {
  const fieldErrors = error.issues.map(issue => {
    const field = issue.path.join('.');
    return `${field}: ${issue.message}`;
  }).join(', ');
  return `Validation failed: ${fieldErrors}`;
}

export function sanitizeError(error: unknown): { message: string; type?: string; details?: unknown } {
  const isProduction = process.env.NODE_ENV === "production";

  // Handle Zod validation errors specially
  if (error instanceof ZodError) {
    const message = formatZodError(error);
    if (isProduction) {
      console.error('Validation error:', message);
    }
    return {
      message,
      type: 'ValidationError',
      details: error.issues
    };
  }

  if (error instanceof Error) {
    if (isProduction) {
      // In production, only expose safe error messages
      // Log full error details server-side
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });

      // Return sanitized error - only expose message if it's a known safe error
      const safeMessages = [
        'Unauthorized',
        'Request must include type',
        'Request must include type and payload',
        'Invalid JSON',
        'Method not allowed',
      ];

      if (safeMessages.includes(error.message)) {
        return { message: error.message, type: error.name };
      }

      // For unknown errors, return generic message
      return { message: 'An error occurred', type: 'Error' };
    } else {
      // In development, expose full error details
      return { message: error.message, type: error.name };
    }
  }

  // Handle non-Error objects
  if (isProduction) {
    return { message: 'An error occurred', type: 'UnknownError' };
  } else {
    return {
      message: typeof error === 'string' ? error : 'An unknown error occurred',
      type: 'UnknownError'
    };
  }
}

