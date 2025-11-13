import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { createPublicCommandsRouter } from '../../../src/infrastructure/routers/publicCommandsRouter'
import { UnitOfWork } from '../../../src/infrastructure/unitOfWork'
import { TransactionBatcher } from '../../../src/infrastructure/transactionBatcher'
import { ProjectionService } from '../../../src/infrastructure/projectionService'
import { createTestDatabase, closeTestDatabase } from '../../helpers/database'

function createTestRouter() {
  const db = createTestDatabase()
  const batcher = new TransactionBatcher(db, {
    flushIntervalMs: 50,
    batchSizeThreshold: 10,
    maxQueueDepth: 100
  })
  batcher.start()

  const unitOfWork = new UnitOfWork(db, batcher)
  const projectionService = new ProjectionService()
  const router = createPublicCommandsRouter(unitOfWork, projectionService)

  return { db, batcher, router }
}

describe('createPublicCommandsRouter', () => {
  test('should return error when command type is unknown', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()
    const type = 'unknownCommand'
    const payload = { id: randomUUIDv7() }

    try {
      // Act
      const result = await router(type, payload)

      // Assert
      expect(result.success).toBe(false)
      if (result.success) throw new Error('Expected failure')
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error.message).toBe('Unknown command type: unknownCommand')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should return error when command type is empty', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()
    const type = ''
    const payload = { id: randomUUIDv7() }

    try {
      // Act
      const result = await router(type, payload)

      // Assert
      expect(result.success).toBe(false)
      if (result.success) throw new Error('Expected failure')
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error.message).toBe('Unknown command type: ')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should return error when command type is missing', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()
    const type = null as any
    const payload = { id: randomUUIDv7() }

    try {
      // Act
      const result = await router(type, payload)

      // Assert
      expect(result.success).toBe(false)
      if (result.success) throw new Error('Expected failure')
      expect(result.error).toBeInstanceOf(Error)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should handle errors gracefully and return Result type', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()
    const type = 'someCommand'
    const payload = undefined

    try {
      // Act
      const result = await router(type, payload)

      // Assert
      expect(result).toHaveProperty('success')
      expect(result.success).toBe(false)
      if (result.success) throw new Error('Expected failure')
      expect(result).toHaveProperty('error')
      expect(result.error).toBeInstanceOf(Error)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should return error for any command type since router is empty', async () => {
    // Arrange
    const { db, batcher, router } = createTestRouter()
    const commandTypes = ['createOrder', 'updateCart', 'checkout', 'anyPublicCommand']

    try {
      // Act & Assert
      for (const type of commandTypes) {
        const result = await router(type, {})
        expect(result.success).toBe(false)
        if (result.success) throw new Error('Expected failure')
        expect(result.error).toBeInstanceOf(Error)
        expect(result.error.message).toContain('Unknown command type')
      }
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})

