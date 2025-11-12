import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { createPublicCommandsRouter } from '../../../src/infrastructure/routers/publicCommandsRouter'
import { UnitOfWork } from '../../../src/infrastructure/unitOfWork'
import { TransactionBatcher } from '../../../src/infrastructure/transactionBatcher'
import { ProjectionService } from '../../../src/infrastructure/projectionService'
import { schemas } from '../../../src/infrastructure/schemas'

describe('createPublicCommandsRouter', () => {
  let db: Database
  let batcher: TransactionBatcher
  let unitOfWork: UnitOfWork
  let projectionService: ProjectionService
  let router: ReturnType<typeof createPublicCommandsRouter>

  beforeEach(() => {
    db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }

    batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    unitOfWork = new UnitOfWork(db, batcher)
    projectionService = new ProjectionService()
    router = createPublicCommandsRouter(unitOfWork, projectionService)
  })

  afterEach(() => {
    batcher.stop()
    db.close()
  })

  test('should return error when command type is unknown', async () => {
    // Arrange
    const type = 'unknownCommand'
    const payload = { id: randomUUIDv7() }

    // Act
    const result = await router(type, payload)

    // Assert
    expect(result.success).toBe(false)
    if (result.success) throw new Error('Expected failure')
    expect(result.error).toBeInstanceOf(Error)
    expect(result.error.message).toBe('Unknown command type: unknownCommand')
  })

  test('should return error when command type is empty', async () => {
    // Arrange
    const type = ''
    const payload = { id: randomUUIDv7() }

    // Act
    const result = await router(type, payload)

    // Assert
    expect(result.success).toBe(false)
    if (result.success) throw new Error('Expected failure')
    expect(result.error).toBeInstanceOf(Error)
    expect(result.error.message).toBe('Unknown command type: ')
  })

  test('should return error when command type is missing', async () => {
    // Arrange
    const type = null as any
    const payload = { id: randomUUIDv7() }

    // Act
    const result = await router(type, payload)

    // Assert
    expect(result.success).toBe(false)
    if (result.success) throw new Error('Expected failure')
    expect(result.error).toBeInstanceOf(Error)
  })

  test('should handle errors gracefully and return Result type', async () => {
    // Arrange
    const type = 'someCommand'
    const payload = undefined

    // Act
    const result = await router(type, payload)

    // Assert
    expect(result).toHaveProperty('success')
    expect(result.success).toBe(false)
    if (result.success) throw new Error('Expected failure')
    expect(result).toHaveProperty('error')
    expect(result.error).toBeInstanceOf(Error)
  })

  test('should return error for any command type since router is empty', async () => {
    // Arrange
    const commandTypes = ['createOrder', 'updateCart', 'checkout', 'anyPublicCommand']

    // Act & Assert
    for (const type of commandTypes) {
      const result = await router(type, {})
      expect(result.success).toBe(false)
      if (result.success) throw new Error('Expected failure')
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error.message).toContain('Unknown command type')
    }
  })
})

