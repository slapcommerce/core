import { describe, test, expect } from 'bun:test'
import { randomUUIDv7 } from 'bun'
import { AdminQueriesRouter } from '../../../../src/api/infrastructure/routers/adminQueriesRouter'
import { createTestDatabase, closeTestDatabase } from '../../../helpers/database'

describe('AdminQueriesRouter', () => {
  test('should create router instance', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      // Act
      const router = AdminQueriesRouter.create(db)

      // Assert
      expect(router).toBeDefined()
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should return error when type is missing', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const router = AdminQueriesRouter.create(db)

      // Act
      const result = router.execute('' as any, {})

      // Assert
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeInstanceOf(Error)
        expect(result.error.message).toBe('Request must include type')
      }
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should return error when type is null', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const router = AdminQueriesRouter.create(db)

      // Act
      const result = router.execute(null as any, {})

      // Assert
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toBe('Request must include type')
      }
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should return error for unknown query type', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const router = AdminQueriesRouter.create(db)

      // Act
      const result = router.execute('unknownQuery' as any, {})

      // Assert
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toBe('Unknown query type: unknownQuery')
      }
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should execute getCollections query successfully', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const router = AdminQueriesRouter.create(db)

      // Act
      const result = router.execute('getCollections', {})

      // Assert
      expect(result.success).toBe(true)
      if (result.success) {
        expect(Array.isArray(result.data)).toBe(true)
      }
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should execute getCollections query with status filter', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const router = AdminQueriesRouter.create(db)

      // Act
      const result = router.execute('getCollections', { status: 'active' })

      // Assert
      expect(result.success).toBe(true)
      if (result.success) {
        expect(Array.isArray(result.data)).toBe(true)
      }
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should execute getCollection query successfully', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const router = AdminQueriesRouter.create(db)
      const collectionId = randomUUIDv7()

      // Act
      const result = router.execute('getCollection', { collectionId })

      // Assert
      expect(result.success).toBe(true)
      // Will return null for non-existent collection
      if (result.success) {
        expect(result.data).toBeNull()
      }
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should execute getSlugRedirectChain query successfully', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const router = AdminQueriesRouter.create(db)

      // Act
      const result = router.execute('getSlugRedirectChain', {
        aggregateId: randomUUIDv7(),
        aggregateType: 'collection',
      })

      // Assert
      expect(result.success).toBe(true)
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should return error when query validation fails', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const router = AdminQueriesRouter.create(db)

      // Act - getCollection requires collectionId
      const result = router.execute('getCollection', {
        // Missing collectionId
      })

      // Assert
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeInstanceOf(Error)
      }
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should handle params being null', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const router = AdminQueriesRouter.create(db)

      // Act
      const result = router.execute('getCollections', null)

      // Assert
      expect(result.success).toBe(true)
      if (result.success) {
        expect(Array.isArray(result.data)).toBe(true)
      }
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should execute getVariants query successfully', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const router = AdminQueriesRouter.create(db)

      // Act
      const result = router.execute('getVariants', {})

      // Assert
      expect(result.success).toBe(true)
      if (result.success) {
        expect(Array.isArray(result.data)).toBe(true)
      }
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should execute getVariants query with productId filter', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const router = AdminQueriesRouter.create(db)

      // Act
      const result = router.execute('getVariants', { productId: 'product-123' })

      // Assert
      expect(result.success).toBe(true)
      if (result.success) {
        expect(Array.isArray(result.data)).toBe(true)
      }
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should execute getVariant query successfully', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const router = AdminQueriesRouter.create(db)
      const variantId = randomUUIDv7()

      // Act
      const result = router.execute('getVariant', { variantId })

      // Assert
      expect(result.success).toBe(true)
      // Will return null for non-existent variant
      if (result.success) {
        expect(result.data).toBeNull()
      }
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should execute getProducts query successfully', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const router = AdminQueriesRouter.create(db)

      // Act
      const result = router.execute('getProducts', {})

      // Assert
      expect(result.success).toBe(true)
      if (result.success) {
        expect(Array.isArray(result.data)).toBe(true)
      }
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should execute getProducts query with status filter', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const router = AdminQueriesRouter.create(db)

      // Act
      const result = router.execute('getProducts', { status: 'active' })

      // Assert
      expect(result.success).toBe(true)
      if (result.success) {
        expect(Array.isArray(result.data)).toBe(true)
      }
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should execute getProduct query successfully', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const router = AdminQueriesRouter.create(db)
      const productId = randomUUIDv7()

      // Act
      const result = router.execute('getProduct', { productId })

      // Assert
      expect(result.success).toBe(true)
      // Will return null for non-existent product
      if (result.success) {
        expect(result.data).toBeNull()
      }
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should execute getCollectionProducts query successfully', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const router = AdminQueriesRouter.create(db)
      const collectionId = randomUUIDv7()

      // Act
      const result = router.execute('getCollectionProducts', { collectionId })

      // Assert
      expect(result.success).toBe(true)
      if (result.success) {
        expect(Array.isArray(result.data)).toBe(true)
      }
    } finally {
      closeTestDatabase(db)
    }
  })

  test('should execute getProductVariants query successfully', () => {
    // Arrange
    const db = createTestDatabase()
    try {
      const router = AdminQueriesRouter.create(db)
      const productId = randomUUIDv7()

      // Act
      const result = router.execute('getProductVariants', { productId })

      // Assert
      expect(result.success).toBe(true)
      if (result.success) {
        expect(Array.isArray(result.data)).toBe(true)
      }
    } finally {
      closeTestDatabase(db)
    }
  })
})
