import { describe, test, expect } from 'bun:test'
import { createTestDatabase, closeTestDatabase } from '../../../../../helpers/database'
import { TransactionBatcher } from '../../../../../../src/api/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../../../../src/api/infrastructure/unitOfWork'
import { CreateBundleService } from '../../../../../../src/api/app/bundle/commands/admin/createBundleService'
import { ArchiveBundleService } from '../../../../../../src/api/app/bundle/commands/admin/archiveBundleService'
import { PublishBundleService } from '../../../../../../src/api/app/bundle/commands/admin/publishBundleService'
import { UnpublishBundleService } from '../../../../../../src/api/app/bundle/commands/admin/unpublishBundleService'
import type { CreateBundleCommand } from '../../../../../../src/api/app/bundle/commands/admin/commands'

async function setupTestEnvironment() {
  const db = createTestDatabase()
  const batcher = new TransactionBatcher(db, {
    flushIntervalMs: 50,
    batchSizeThreshold: 10,
    maxQueueDepth: 100
  })
  batcher.start()
  const unitOfWork = new UnitOfWork(db, batcher)
  return { db, batcher, unitOfWork }
}

function createValidBundleCommand(): CreateBundleCommand {
  return {
    type: 'createBundle',
    id: '01930000-0000-7000-8000-000000000001',
    correlationId: '01930000-0000-7000-8000-000000000002',
    userId: 'user-123',
    name: 'Test Bundle',
    description: 'A test bundle',
    slug: 'test-bundle',
    items: [{ variantId: '01930000-0000-7000-8000-000000000003', quantity: 2 }],
    price: 99.99,
    compareAtPrice: 129.99,
    metaTitle: 'Test Bundle Meta',
    metaDescription: 'Test bundle description',
    richDescriptionUrl: 'https://example.com/description',
    tags: ['tag1', 'tag2'],
    collections: [],
    taxable: true,
    taxId: 'TAX123',
  }
}

async function createBundleInDatabase(unitOfWork: UnitOfWork, command: CreateBundleCommand) {
  const createService = new CreateBundleService(unitOfWork)
  await createService.execute(command)
}

describe('ArchiveBundleService', () => {
  test('should successfully archive a draft bundle', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      const service = new ArchiveBundleService(unitOfWork)
      await service.execute({
        type: 'archiveBundle',
        id: createCommand.id,
        userId: 'user-123',
        expectedVersion: 0,
      })

      const snapshot = db.query(`
        SELECT payload, version FROM snapshots WHERE aggregateId = ?
      `).get(createCommand.id) as any

      expect(snapshot.version).toBe(1)
      const payload = JSON.parse(snapshot.payload)
      expect(payload.status).toBe('archived')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should archive a published bundle', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      // First publish
      const publishService = new PublishBundleService(unitOfWork)
      await publishService.execute({
        type: 'publishBundle',
        id: createCommand.id,
        userId: 'user-123',
        expectedVersion: 0,
      })

      // Then archive
      const archiveService = new ArchiveBundleService(unitOfWork)
      await archiveService.execute({
        type: 'archiveBundle',
        id: createCommand.id,
        userId: 'user-123',
        expectedVersion: 1,
      })

      const snapshot = db.query(`
        SELECT payload, version FROM snapshots WHERE aggregateId = ?
      `).get(createCommand.id) as any

      expect(snapshot.version).toBe(2)
      const payload = JSON.parse(snapshot.payload)
      expect(payload.status).toBe('archived')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when bundle not found', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const service = new ArchiveBundleService(unitOfWork)

      await expect(service.execute({
        type: 'archiveBundle',
        id: '01930000-0000-7000-8000-000000000099',
        userId: 'user-123',
        expectedVersion: 0,
      })).rejects.toThrow('Bundle not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error on version mismatch', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      const service = new ArchiveBundleService(unitOfWork)

      await expect(service.execute({
        type: 'archiveBundle',
        id: createCommand.id,
        userId: 'user-123',
        expectedVersion: 5,
      })).rejects.toThrow('Version mismatch')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when bundle already archived', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      const service = new ArchiveBundleService(unitOfWork)
      await service.execute({
        type: 'archiveBundle',
        id: createCommand.id,
        userId: 'user-123',
        expectedVersion: 0,
      })

      await expect(service.execute({
        type: 'archiveBundle',
        id: createCommand.id,
        userId: 'user-123',
        expectedVersion: 1,
      })).rejects.toThrow('already archived')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should add event to outbox', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      const initialOutbox = db.query(`
        SELECT COUNT(*) as count FROM outbox WHERE aggregateId = ?
      `).get(createCommand.id) as any

      const service = new ArchiveBundleService(unitOfWork)
      await service.execute({
        type: 'archiveBundle',
        id: createCommand.id,
        userId: 'user-123',
        expectedVersion: 0,
      })

      const finalOutbox = db.query(`
        SELECT COUNT(*) as count FROM outbox WHERE aggregateId = ?
      `).get(createCommand.id) as any

      expect(finalOutbox.count).toBe(initialOutbox.count + 1)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})

describe('PublishBundleService', () => {
  test('should successfully publish a draft bundle', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      const service = new PublishBundleService(unitOfWork)
      await service.execute({
        type: 'publishBundle',
        id: createCommand.id,
        userId: 'user-123',
        expectedVersion: 0,
      })

      const snapshot = db.query(`
        SELECT payload, version FROM snapshots WHERE aggregateId = ?
      `).get(createCommand.id) as any

      expect(snapshot.version).toBe(1)
      const payload = JSON.parse(snapshot.payload)
      expect(payload.status).toBe('active')
      expect(payload.publishedAt).not.toBeNull()
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when bundle not found', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const service = new PublishBundleService(unitOfWork)

      await expect(service.execute({
        type: 'publishBundle',
        id: '01930000-0000-7000-8000-000000000099',
        userId: 'user-123',
        expectedVersion: 0,
      })).rejects.toThrow('Bundle not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error on version mismatch', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      const service = new PublishBundleService(unitOfWork)

      await expect(service.execute({
        type: 'publishBundle',
        id: createCommand.id,
        userId: 'user-123',
        expectedVersion: 10,
      })).rejects.toThrow('Version mismatch')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when bundle already published', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      const service = new PublishBundleService(unitOfWork)
      await service.execute({
        type: 'publishBundle',
        id: createCommand.id,
        userId: 'user-123',
        expectedVersion: 0,
      })

      await expect(service.execute({
        type: 'publishBundle',
        id: createCommand.id,
        userId: 'user-123',
        expectedVersion: 1,
      })).rejects.toThrow('already published')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when trying to publish archived bundle', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      // First archive
      const archiveService = new ArchiveBundleService(unitOfWork)
      await archiveService.execute({
        type: 'archiveBundle',
        id: createCommand.id,
        userId: 'user-123',
        expectedVersion: 0,
      })

      // Try to publish
      const publishService = new PublishBundleService(unitOfWork)
      await expect(publishService.execute({
        type: 'publishBundle',
        id: createCommand.id,
        userId: 'user-123',
        expectedVersion: 1,
      })).rejects.toThrow('Cannot publish an archived bundle')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should add event to outbox', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      const initialOutbox = db.query(`
        SELECT COUNT(*) as count FROM outbox WHERE aggregateId = ?
      `).get(createCommand.id) as any

      const service = new PublishBundleService(unitOfWork)
      await service.execute({
        type: 'publishBundle',
        id: createCommand.id,
        userId: 'user-123',
        expectedVersion: 0,
      })

      const finalOutbox = db.query(`
        SELECT COUNT(*) as count FROM outbox WHERE aggregateId = ?
      `).get(createCommand.id) as any

      expect(finalOutbox.count).toBe(initialOutbox.count + 1)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})

describe('UnpublishBundleService', () => {
  test('should successfully unpublish a published bundle', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      // First publish
      const publishService = new PublishBundleService(unitOfWork)
      await publishService.execute({
        type: 'publishBundle',
        id: createCommand.id,
        userId: 'user-123',
        expectedVersion: 0,
      })

      // Then unpublish
      const unpublishService = new UnpublishBundleService(unitOfWork)
      await unpublishService.execute({
        type: 'unpublishBundle',
        id: createCommand.id,
        userId: 'user-123',
        expectedVersion: 1,
      })

      const snapshot = db.query(`
        SELECT payload, version FROM snapshots WHERE aggregateId = ?
      `).get(createCommand.id) as any

      expect(snapshot.version).toBe(2)
      const payload = JSON.parse(snapshot.payload)
      expect(payload.status).toBe('draft')
      expect(payload.publishedAt).toBeNull()
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when bundle not found', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const service = new UnpublishBundleService(unitOfWork)

      await expect(service.execute({
        type: 'unpublishBundle',
        id: '01930000-0000-7000-8000-000000000099',
        userId: 'user-123',
        expectedVersion: 0,
      })).rejects.toThrow('Bundle not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error on version mismatch', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      // First publish
      const publishService = new PublishBundleService(unitOfWork)
      await publishService.execute({
        type: 'publishBundle',
        id: createCommand.id,
        userId: 'user-123',
        expectedVersion: 0,
      })

      const service = new UnpublishBundleService(unitOfWork)
      await expect(service.execute({
        type: 'unpublishBundle',
        id: createCommand.id,
        userId: 'user-123',
        expectedVersion: 10,
      })).rejects.toThrow('Version mismatch')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when bundle already unpublished (draft)', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      const service = new UnpublishBundleService(unitOfWork)
      await expect(service.execute({
        type: 'unpublishBundle',
        id: createCommand.id,
        userId: 'user-123',
        expectedVersion: 0,
      })).rejects.toThrow('already unpublished')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when trying to unpublish archived bundle', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      // First archive
      const archiveService = new ArchiveBundleService(unitOfWork)
      await archiveService.execute({
        type: 'archiveBundle',
        id: createCommand.id,
        userId: 'user-123',
        expectedVersion: 0,
      })

      // Try to unpublish
      const unpublishService = new UnpublishBundleService(unitOfWork)
      await expect(unpublishService.execute({
        type: 'unpublishBundle',
        id: createCommand.id,
        userId: 'user-123',
        expectedVersion: 1,
      })).rejects.toThrow('Cannot unpublish an archived bundle')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should add event to outbox', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      // First publish
      const publishService = new PublishBundleService(unitOfWork)
      await publishService.execute({
        type: 'publishBundle',
        id: createCommand.id,
        userId: 'user-123',
        expectedVersion: 0,
      })

      const initialOutbox = db.query(`
        SELECT COUNT(*) as count FROM outbox WHERE aggregateId = ?
      `).get(createCommand.id) as any

      // Then unpublish
      const unpublishService = new UnpublishBundleService(unitOfWork)
      await unpublishService.execute({
        type: 'unpublishBundle',
        id: createCommand.id,
        userId: 'user-123',
        expectedVersion: 1,
      })

      const finalOutbox = db.query(`
        SELECT COUNT(*) as count FROM outbox WHERE aggregateId = ?
      `).get(createCommand.id) as any

      expect(finalOutbox.count).toBe(initialOutbox.count + 1)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
