import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { ZodError, z } from 'zod'
import { sanitizeError } from '../../../src/api/infrastructure/errorSanitizer'

describe('errorSanitizer', () => {
  describe('sanitizeError', () => {
    describe('Development mode', () => {
      beforeAll(() => {
        process.env.NODE_ENV = 'development'
      })

      afterAll(() => {
        delete process.env.NODE_ENV
      })

      test('should expose full error message for Error instances', () => {
        // Arrange
        const error = new Error('Something specific went wrong')

        // Act
        const result = sanitizeError(error)

        // Assert
        expect(result.message).toBe('Something specific went wrong')
        expect(result.type).toBe('Error')
      })

      test('should expose custom error types', () => {
        // Arrange
        class CustomError extends Error {
          constructor(message: string) {
            super(message)
            this.name = 'CustomError'
          }
        }
        const error = new CustomError('Custom error message')

        // Act
        const result = sanitizeError(error)

        // Assert
        expect(result.message).toBe('Custom error message')
        expect(result.type).toBe('CustomError')
      })

      test('should handle string errors', () => {
        // Arrange
        const error = 'A string error'

        // Act
        const result = sanitizeError(error)

        // Assert
        expect(result.message).toBe('A string error')
        expect(result.type).toBe('UnknownError')
      })

      test('should handle non-string, non-Error objects', () => {
        // Arrange
        const error = { code: 500, details: 'Something failed' }

        // Act
        const result = sanitizeError(error)

        // Assert
        expect(result.message).toBe('An unknown error occurred')
        expect(result.type).toBe('UnknownError')
      })

      test('should handle null errors', () => {
        // Arrange
        const error = null

        // Act
        const result = sanitizeError(error)

        // Assert
        expect(result.message).toBe('An unknown error occurred')
        expect(result.type).toBe('UnknownError')
      })

      test('should handle undefined errors', () => {
        // Arrange
        const error = undefined

        // Act
        const result = sanitizeError(error)

        // Assert
        expect(result.message).toBe('An unknown error occurred')
        expect(result.type).toBe('UnknownError')
      })

      test('should format ZodError with field errors', () => {
        // Arrange
        const schema = z.object({
          name: z.string().min(1),
          email: z.string().email(),
        })
        let error: ZodError | null = null
        try {
          schema.parse({ name: '', email: 'not-an-email' })
        } catch (e) {
          error = e as ZodError
        }

        // Act
        const result = sanitizeError(error)

        // Assert
        expect(result.type).toBe('ValidationError')
        expect(result.message).toContain('Validation failed')
        expect(result.details).toBeDefined()
        expect(Array.isArray(result.details)).toBe(true)
      })
    })

    describe('Production mode', () => {
      beforeAll(() => {
        process.env.NODE_ENV = 'production'
      })

      afterAll(() => {
        delete process.env.NODE_ENV
      })

      test('should expose safe error message: Unauthorized', () => {
        // Arrange
        const error = new Error('Unauthorized')

        // Act
        const result = sanitizeError(error)

        // Assert
        expect(result.message).toBe('Unauthorized')
        expect(result.type).toBe('Error')
      })

      test('should expose safe error message: Request must include type', () => {
        // Arrange
        const error = new Error('Request must include type')

        // Act
        const result = sanitizeError(error)

        // Assert
        expect(result.message).toBe('Request must include type')
        expect(result.type).toBe('Error')
      })

      test('should expose safe error message: Request must include type and payload', () => {
        // Arrange
        const error = new Error('Request must include type and payload')

        // Act
        const result = sanitizeError(error)

        // Assert
        expect(result.message).toBe('Request must include type and payload')
        expect(result.type).toBe('Error')
      })

      test('should expose safe error message: Invalid JSON', () => {
        // Arrange
        const error = new Error('Invalid JSON')

        // Act
        const result = sanitizeError(error)

        // Assert
        expect(result.message).toBe('Invalid JSON')
        expect(result.type).toBe('Error')
      })

      test('should expose safe error message: Method not allowed', () => {
        // Arrange
        const error = new Error('Method not allowed')

        // Act
        const result = sanitizeError(error)

        // Assert
        expect(result.message).toBe('Method not allowed')
        expect(result.type).toBe('Error')
      })

      test('should sanitize unknown Error messages to generic message', () => {
        // Arrange
        const error = new Error('Database connection failed: password incorrect')

        // Act
        const result = sanitizeError(error)

        // Assert
        expect(result.message).toBe('An error occurred')
        expect(result.type).toBe('Error')
      })

      test('should not expose internal error details', () => {
        // Arrange
        const error = new Error('Internal server error: /Users/ryan/project/src/service.ts:42')

        // Act
        const result = sanitizeError(error)

        // Assert
        expect(result.message).toBe('An error occurred')
        expect(result.message).not.toContain('/Users')
        expect(result.message).not.toContain('.ts')
      })

      test('should sanitize non-Error objects to generic message', () => {
        // Arrange
        const error = { code: 500, secret: 'password123' }

        // Act
        const result = sanitizeError(error)

        // Assert
        expect(result.message).toBe('An error occurred')
        expect(result.type).toBe('UnknownError')
        expect(JSON.stringify(result)).not.toContain('password123')
      })

      test('should sanitize string errors to generic message', () => {
        // Arrange
        const error = 'Secret database password: xyz123'

        // Act
        const result = sanitizeError(error)

        // Assert
        // In production, non-Error objects get generic message
        expect(result.message).toBe('An error occurred')
        expect(result.type).toBe('UnknownError')
      })

      test('should sanitize null to generic message', () => {
        // Arrange
        const error = null

        // Act
        const result = sanitizeError(error)

        // Assert
        expect(result.message).toBe('An error occurred')
        expect(result.type).toBe('UnknownError')
      })

      test('should format ZodError with field errors in production', () => {
        // Arrange
        const schema = z.object({
          name: z.string().min(1),
          age: z.number().positive(),
        })
        let error: ZodError | null = null
        try {
          schema.parse({ name: '', age: -5 })
        } catch (e) {
          error = e as ZodError
        }

        // Act
        const result = sanitizeError(error)

        // Assert
        expect(result.type).toBe('ValidationError')
        expect(result.message).toContain('Validation failed')
        expect(result.details).toBeDefined()
      })

      test('should handle ZodError with nested paths', () => {
        // Arrange
        const schema = z.object({
          user: z.object({
            profile: z.object({
              name: z.string().min(1),
            }),
          }),
        })
        let error: ZodError | null = null
        try {
          schema.parse({ user: { profile: { name: '' } } })
        } catch (e) {
          error = e as ZodError
        }

        // Act
        const result = sanitizeError(error)

        // Assert
        expect(result.type).toBe('ValidationError')
        expect(result.message).toContain('user.profile.name')
      })
    })
  })
})
