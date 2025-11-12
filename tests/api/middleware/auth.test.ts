import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { requireBasicAuth } from '../../../src/middleware/auth'

describe('requireBasicAuth', () => {
  let originalUsername: string | undefined
  let originalPassword: string | undefined

  beforeEach(() => {
    // Save original env vars
    originalUsername = process.env.ADMIN_USERNAME
    originalPassword = process.env.ADMIN_PASSWORD
    // Clear env vars for default test
    delete process.env.ADMIN_USERNAME
    delete process.env.ADMIN_PASSWORD
  })

  afterEach(() => {
    // Restore original env vars
    if (originalUsername !== undefined) {
      process.env.ADMIN_USERNAME = originalUsername
    } else {
      delete process.env.ADMIN_USERNAME
    }
    if (originalPassword !== undefined) {
      process.env.ADMIN_PASSWORD = originalPassword
    } else {
      delete process.env.ADMIN_PASSWORD
    }
  })

  test('should return null when authentication succeeds with valid Basic Auth credentials', () => {
    // Arrange
    const credentials = Buffer.from('admin:admin').toString('base64')
    const request = new Request('http://localhost/test', {
      headers: {
        'Authorization': `Basic ${credentials}`
      }
    })

    // Act
    const result = requireBasicAuth(request)

    // Assert
    expect(result).toBeNull()
  })

  test('should return 401 response when Authorization header is missing', () => {
    // Arrange
    const request = new Request('http://localhost/test', {
      headers: {}
    })

    // Act
    const result = requireBasicAuth(request)

    // Assert
    expect(result).not.toBeNull()
    expect(result?.status).toBe(401)
    expect(result?.headers.get('WWW-Authenticate')).toBe('Basic realm="Admin API"')
    expect(result?.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  test('should return 401 response when Authorization header does not start with "Basic "', () => {
    // Arrange
    const request = new Request('http://localhost/test', {
      headers: {
        'Authorization': 'Bearer token123'
      }
    })

    // Act
    const result = requireBasicAuth(request)

    // Assert
    expect(result).not.toBeNull()
    expect(result?.status).toBe(401)
    expect(result?.headers.get('WWW-Authenticate')).toBe('Basic realm="Admin API"')
    expect(result?.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  test('should return 401 response when username is incorrect', () => {
    // Arrange
    const credentials = Buffer.from('wronguser:admin').toString('base64')
    const request = new Request('http://localhost/test', {
      headers: {
        'Authorization': `Basic ${credentials}`
      }
    })

    // Act
    const result = requireBasicAuth(request)

    // Assert
    expect(result).not.toBeNull()
    expect(result?.status).toBe(401)
    expect(result?.headers.get('WWW-Authenticate')).toBe('Basic realm="Admin API"')
    expect(result?.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  test('should return 401 response when password is incorrect', () => {
    // Arrange
    const credentials = Buffer.from('admin:wrongpass').toString('base64')
    const request = new Request('http://localhost/test', {
      headers: {
        'Authorization': `Basic ${credentials}`
      }
    })

    // Act
    const result = requireBasicAuth(request)

    // Assert
    expect(result).not.toBeNull()
    expect(result?.status).toBe(401)
    expect(result?.headers.get('WWW-Authenticate')).toBe('Basic realm="Admin API"')
    expect(result?.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  test('should use environment variables for credentials when set', () => {
    // Arrange
    process.env.ADMIN_USERNAME = 'customuser'
    process.env.ADMIN_PASSWORD = 'custompass'
    const credentials = Buffer.from('customuser:custompass').toString('base64')
    const request = new Request('http://localhost/test', {
      headers: {
        'Authorization': `Basic ${credentials}`
      }
    })

    // Act
    const result = requireBasicAuth(request)

    // Assert
    expect(result).toBeNull()
  })

  test('should reject credentials when environment variables are set but credentials do not match', () => {
    // Arrange
    process.env.ADMIN_USERNAME = 'customuser'
    process.env.ADMIN_PASSWORD = 'custompass'
    const credentials = Buffer.from('admin:admin').toString('base64')
    const request = new Request('http://localhost/test', {
      headers: {
        'Authorization': `Basic ${credentials}`
      }
    })

    // Act
    const result = requireBasicAuth(request)

    // Assert
    expect(result).not.toBeNull()
    expect(result?.status).toBe(401)
  })

  test('should use default credentials when environment variables are not set', () => {
    // Arrange
    delete process.env.ADMIN_USERNAME
    delete process.env.ADMIN_PASSWORD
    const credentials = Buffer.from('admin:admin').toString('base64')
    const request = new Request('http://localhost/test', {
      headers: {
        'Authorization': `Basic ${credentials}`
      }
    })

    // Act
    const result = requireBasicAuth(request)

    // Assert
    expect(result).toBeNull()
  })

  test('should handle malformed base64 credentials gracefully', () => {
    // Arrange
    const request = new Request('http://localhost/test', {
      headers: {
        'Authorization': 'Basic invalid-base64!!!'
      }
    })

    // Act
    const result = requireBasicAuth(request)

    // Assert - Should still attempt to decode and fail on username/password check
    expect(result).not.toBeNull()
    expect(result?.status).toBe(401)
  })

  test('should handle credentials without colon separator', () => {
    // Arrange
    const credentials = Buffer.from('nocolon').toString('base64')
    const request = new Request('http://localhost/test', {
      headers: {
        'Authorization': `Basic ${credentials}`
      }
    })

    // Act
    const result = requireBasicAuth(request)

    // Assert - Should fail on username/password check
    expect(result).not.toBeNull()
    expect(result?.status).toBe(401)
  })
})

