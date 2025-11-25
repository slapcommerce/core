import { describe, test, expect } from 'bun:test'
import { UpdateProductTaxDetailsCommand } from '../../../../src/api/app/product/commands/commands'
import { randomUUIDv7 } from 'bun'

describe('UpdateProductTaxDetailsCommand', () => {
  describe('valid commands', () => {
    test('should validate a valid command', () => {
      // Arrange
      const validCommand = {
        id: randomUUIDv7(),
        type: 'updateProductTaxDetails' as const,
        userId: 'user-123',
        taxable: true,
        taxId: 'TAX123',
        expectedVersion: 0,
      }

      // Act
      const result = UpdateProductTaxDetailsCommand.safeParse(validCommand)

      // Assert
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validCommand)
      }
    })

    test('should validate when taxable is false', () => {
      // Arrange
      const validCommand = {
        id: randomUUIDv7(),
        type: 'updateProductTaxDetails' as const,
        userId: 'user-123',
        taxable: false,
        taxId: 'TAX123',
        expectedVersion: 0,
      }

      // Act
      const result = UpdateProductTaxDetailsCommand.safeParse(validCommand)

      // Assert
      expect(result.success).toBe(true)
    })

    test('should validate when taxable is true', () => {
      // Arrange
      const validCommand = {
        id: randomUUIDv7(),
        type: 'updateProductTaxDetails' as const,
        userId: 'user-123',
        taxable: true,
        taxId: 'TAX123',
        expectedVersion: 0,
      }

      // Act
      const result = UpdateProductTaxDetailsCommand.safeParse(validCommand)

      // Assert
      expect(result.success).toBe(true)
    })

    test('should validate with non-zero expectedVersion', () => {
      // Arrange
      const validCommand = {
        id: randomUUIDv7(),
        type: 'updateProductTaxDetails' as const,
        userId: 'user-123',
        taxable: true,
        taxId: 'TAX123',
        expectedVersion: 5,
      }

      // Act
      const result = UpdateProductTaxDetailsCommand.safeParse(validCommand)

      // Assert
      expect(result.success).toBe(true)
    })

    test('should validate with single character taxId', () => {
      // Arrange
      const validCommand = {
        id: randomUUIDv7(),
        type: 'updateProductTaxDetails' as const,
        userId: 'user-123',
        taxable: true,
        taxId: 'T',
        expectedVersion: 0,
      }

      // Act
      const result = UpdateProductTaxDetailsCommand.safeParse(validCommand)

      // Assert
      expect(result.success).toBe(true)
    })

    test('should validate with long taxId', () => {
      // Arrange
      const validCommand = {
        id: randomUUIDv7(),
        type: 'updateProductTaxDetails' as const,
        userId: 'user-123',
        taxable: true,
        taxId: 'A'.repeat(100),
        expectedVersion: 0,
      }

      // Act
      const result = UpdateProductTaxDetailsCommand.safeParse(validCommand)

      // Assert
      expect(result.success).toBe(true)
    })
  })

  describe('invalid commands', () => {
    test('should reject command with missing id', () => {
      // Arrange
      const invalidCommand = {
        type: 'updateProductTaxDetails' as const,
        userId: 'user-123',
        taxable: true,
        taxId: 'TAX123',
        expectedVersion: 0,
      }

      // Act
      const result = UpdateProductTaxDetailsCommand.safeParse(invalidCommand)

      // Assert
      expect(result.success).toBe(false)
    })

    test('should reject command with invalid id', () => {
      // Arrange
      const invalidCommand = {
        id: 'not-a-uuid',
        type: 'updateProductTaxDetails' as const,
        userId: 'user-123',
        taxable: true,
        taxId: 'TAX123',
        expectedVersion: 0,
      }

      // Act
      const result = UpdateProductTaxDetailsCommand.safeParse(invalidCommand)

      // Assert
      expect(result.success).toBe(false)
    })

    test('should reject command with missing type', () => {
      // Arrange
      const invalidCommand = {
        id: randomUUIDv7(),
        userId: 'user-123',
        taxable: true,
        taxId: 'TAX123',
        expectedVersion: 0,
      }

      // Act
      const result = UpdateProductTaxDetailsCommand.safeParse(invalidCommand)

      // Assert
      expect(result.success).toBe(false)
    })

    test('should reject command with wrong type', () => {
      // Arrange
      const invalidCommand = {
        id: randomUUIDv7(),
        type: 'wrongType',
        userId: 'user-123',
        taxable: true,
        taxId: 'TAX123',
        expectedVersion: 0,
      }

      // Act
      const result = UpdateProductTaxDetailsCommand.safeParse(invalidCommand)

      // Assert
      expect(result.success).toBe(false)
    })

    test('should reject command with missing userId', () => {
      // Arrange
      const invalidCommand = {
        id: randomUUIDv7(),
        type: 'updateProductTaxDetails' as const,
        taxable: true,
        taxId: 'TAX123',
        expectedVersion: 0,
      }

      // Act
      const result = UpdateProductTaxDetailsCommand.safeParse(invalidCommand)

      // Assert
      expect(result.success).toBe(false)
    })

    test('should reject command with missing taxable', () => {
      // Arrange
      const invalidCommand = {
        id: randomUUIDv7(),
        type: 'updateProductTaxDetails' as const,
        userId: 'user-123',
        taxId: 'TAX123',
        expectedVersion: 0,
      }

      // Act
      const result = UpdateProductTaxDetailsCommand.safeParse(invalidCommand)

      // Assert
      expect(result.success).toBe(false)
    })

    test('should reject command with non-boolean taxable', () => {
      // Arrange
      const invalidCommand = {
        id: randomUUIDv7(),
        type: 'updateProductTaxDetails' as const,
        userId: 'user-123',
        taxable: 'true',
        taxId: 'TAX123',
        expectedVersion: 0,
      }

      // Act
      const result = UpdateProductTaxDetailsCommand.safeParse(invalidCommand)

      // Assert
      expect(result.success).toBe(false)
    })

    test('should reject command with missing taxId', () => {
      // Arrange
      const invalidCommand = {
        id: randomUUIDv7(),
        type: 'updateProductTaxDetails' as const,
        userId: 'user-123',
        taxable: true,
        expectedVersion: 0,
      }

      // Act
      const result = UpdateProductTaxDetailsCommand.safeParse(invalidCommand)

      // Assert
      expect(result.success).toBe(false)
    })

    test('should reject command with empty taxId', () => {
      // Arrange
      const invalidCommand = {
        id: randomUUIDv7(),
        type: 'updateProductTaxDetails' as const,
        userId: 'user-123',
        taxable: true,
        taxId: '',
        expectedVersion: 0,
      }

      // Act
      const result = UpdateProductTaxDetailsCommand.safeParse(invalidCommand)

      // Assert
      expect(result.success).toBe(false)
    })

    test('should reject command with missing expectedVersion', () => {
      // Arrange
      const invalidCommand = {
        id: randomUUIDv7(),
        type: 'updateProductTaxDetails' as const,
        userId: 'user-123',
        taxable: true,
        taxId: 'TAX123',
      }

      // Act
      const result = UpdateProductTaxDetailsCommand.safeParse(invalidCommand)

      // Assert
      expect(result.success).toBe(false)
    })

    test('should reject command with negative expectedVersion', () => {
      // Arrange
      const invalidCommand = {
        id: randomUUIDv7(),
        type: 'updateProductTaxDetails' as const,
        userId: 'user-123',
        taxable: true,
        taxId: 'TAX123',
        expectedVersion: -1,
      }

      // Act
      const result = UpdateProductTaxDetailsCommand.safeParse(invalidCommand)

      // Assert
      expect(result.success).toBe(false)
    })

    test('should reject command with non-integer expectedVersion', () => {
      // Arrange
      const invalidCommand = {
        id: randomUUIDv7(),
        type: 'updateProductTaxDetails' as const,
        userId: 'user-123',
        taxable: true,
        taxId: 'TAX123',
        expectedVersion: 1.5,
      }

      // Act
      const result = UpdateProductTaxDetailsCommand.safeParse(invalidCommand)

      // Assert
      expect(result.success).toBe(false)
    })

    test('should reject command with string expectedVersion', () => {
      // Arrange
      const invalidCommand = {
        id: randomUUIDv7(),
        type: 'updateProductTaxDetails' as const,
        userId: 'user-123',
        taxable: true,
        taxId: 'TAX123',
        expectedVersion: '0',
      }

      // Act
      const result = UpdateProductTaxDetailsCommand.safeParse(invalidCommand)

      // Assert
      expect(result.success).toBe(false)
    })
  })

  describe('error messages', () => {
    test('should provide error message for empty taxId', () => {
      // Arrange
      const invalidCommand = {
        id: randomUUIDv7(),
        type: 'updateProductTaxDetails' as const,
        userId: 'user-123',
        taxable: true,
        taxId: '',
        expectedVersion: 0,
      }

      // Act
      const result = UpdateProductTaxDetailsCommand.safeParse(invalidCommand)

      // Assert
      expect(result.success).toBe(false)
      if (!result.success) {
        const taxIdError = result.error.issues.find(issue => issue.path.includes('taxId'))
        expect(taxIdError).toBeDefined()
      }
    })

    test('should provide error message for invalid taxable type', () => {
      // Arrange
      const invalidCommand = {
        id: randomUUIDv7(),
        type: 'updateProductTaxDetails' as const,
        userId: 'user-123',
        taxable: 'not-a-boolean',
        taxId: 'TAX123',
        expectedVersion: 0,
      }

      // Act
      const result = UpdateProductTaxDetailsCommand.safeParse(invalidCommand)

      // Assert
      expect(result.success).toBe(false)
      if (!result.success) {
        const taxableError = result.error.issues.find(issue => issue.path.includes('taxable'))
        expect(taxableError).toBeDefined()
      }
    })
  })
})
