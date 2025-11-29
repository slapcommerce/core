import { describe, test, expect } from 'bun:test'
import { createTestDatabase, closeTestDatabase } from '../../../../../helpers/database'
import { TransactionBatcher } from '../../../../../../src/api/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../../../../src/api/infrastructure/unitOfWork'
import { CreateBundleService } from '../../../../../../src/api/app/bundle/commands/admin/createBundleService'
import { UpdateBundleItemsService } from '../../../../../../src/api/app/bundle/commands/admin/updateBundleItemsService'
import { UpdateBundleDetailsService } from '../../../../../../src/api/app/bundle/commands/admin/updateBundleDetailsService'
import { UpdateBundleMetadataService } from '../../../../../../src/api/app/bundle/commands/admin/updateBundleMetadataService'
import { UpdateBundlePriceService } from '../../../../../../src/api/app/bundle/commands/admin/updateBundlePriceService'
import { UpdateBundleTaxDetailsService } from '../../../../../../src/api/app/bundle/commands/admin/updateBundleTaxDetailsService'
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
    items: [
      { variantId: '01930000-0000-7000-8000-000000000003', quantity: 2 },
    ],
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

describe('UpdateBundleItemsService', () => {
  test('should successfully update bundle items', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      const service = new UpdateBundleItemsService(unitOfWork)
      const newItems = [
        { variantId: '01930000-0000-7000-8000-000000000004', quantity: 5 },
        { variantId: '01930000-0000-7000-8000-000000000005', quantity: 3 },
      ]

      await service.execute({
        type: 'updateBundleItems',
        id: createCommand.id,
        userId: 'user-123',
        items: newItems,
        expectedVersion: 0,
      })

      const snapshot = db.query(`
        SELECT payload, version FROM snapshots WHERE aggregateId = ?
      `).get(createCommand.id) as any

      expect(snapshot.version).toBe(1)
      const payload = JSON.parse(snapshot.payload)
      expect(payload.items).toEqual(newItems)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when bundle not found', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const service = new UpdateBundleItemsService(unitOfWork)

      await expect(service.execute({
        type: 'updateBundleItems',
        id: '01930000-0000-7000-8000-000000000099',
        userId: 'user-123',
        items: [{ variantId: '01930000-0000-7000-8000-000000000003', quantity: 1 }],
        expectedVersion: 0,
      })).rejects.toThrow('Bundle with id 01930000-0000-7000-8000-000000000099 not found')
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

      const service = new UpdateBundleItemsService(unitOfWork)

      await expect(service.execute({
        type: 'updateBundleItems',
        id: createCommand.id,
        userId: 'user-123',
        items: [{ variantId: '01930000-0000-7000-8000-000000000003', quantity: 1 }],
        expectedVersion: 5, // Wrong version
      })).rejects.toThrow('Optimistic concurrency conflict')
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

      const service = new UpdateBundleItemsService(unitOfWork)
      await service.execute({
        type: 'updateBundleItems',
        id: createCommand.id,
        userId: 'user-123',
        items: [{ variantId: '01930000-0000-7000-8000-000000000004', quantity: 1 }],
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

describe('UpdateBundleDetailsService', () => {
  test('should successfully update bundle details', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      const service = new UpdateBundleDetailsService(unitOfWork)
      await service.execute({
        type: 'updateBundleDetails',
        id: createCommand.id,
        userId: 'user-123',
        name: 'Updated Bundle Name',
        description: 'Updated description',
        richDescriptionUrl: 'https://example.com/new-description',
        expectedVersion: 0,
      })

      const snapshot = db.query(`
        SELECT payload, version FROM snapshots WHERE aggregateId = ?
      `).get(createCommand.id) as any

      expect(snapshot.version).toBe(1)
      const payload = JSON.parse(snapshot.payload)
      expect(payload.name).toBe('Updated Bundle Name')
      expect(payload.description).toBe('Updated description')
      expect(payload.richDescriptionUrl).toBe('https://example.com/new-description')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when bundle not found', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const service = new UpdateBundleDetailsService(unitOfWork)

      await expect(service.execute({
        type: 'updateBundleDetails',
        id: '01930000-0000-7000-8000-000000000099',
        userId: 'user-123',
        name: 'Name',
        description: 'Desc',
        richDescriptionUrl: '',
        expectedVersion: 0,
      })).rejects.toThrow('not found')
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

      const service = new UpdateBundleDetailsService(unitOfWork)

      await expect(service.execute({
        type: 'updateBundleDetails',
        id: createCommand.id,
        userId: 'user-123',
        name: 'Name',
        description: 'Desc',
        richDescriptionUrl: '',
        expectedVersion: 10,
      })).rejects.toThrow('concurrency')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})

describe('UpdateBundleMetadataService', () => {
  test('should successfully update bundle metadata', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      const service = new UpdateBundleMetadataService(unitOfWork)
      await service.execute({
        type: 'updateBundleMetadata',
        id: createCommand.id,
        userId: 'user-123',
        metaTitle: 'New Meta Title',
        metaDescription: 'New meta description',
        tags: ['newtag1', 'newtag2', 'newtag3'],
        expectedVersion: 0,
      })

      const snapshot = db.query(`
        SELECT payload, version FROM snapshots WHERE aggregateId = ?
      `).get(createCommand.id) as any

      expect(snapshot.version).toBe(1)
      const payload = JSON.parse(snapshot.payload)
      expect(payload.metaTitle).toBe('New Meta Title')
      expect(payload.metaDescription).toBe('New meta description')
      expect(payload.tags).toEqual(['newtag1', 'newtag2', 'newtag3'])
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should allow empty tags array', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      const service = new UpdateBundleMetadataService(unitOfWork)
      await service.execute({
        type: 'updateBundleMetadata',
        id: createCommand.id,
        userId: 'user-123',
        metaTitle: 'Title',
        metaDescription: 'Desc',
        tags: [],
        expectedVersion: 0,
      })

      const snapshot = db.query(`
        SELECT payload FROM snapshots WHERE aggregateId = ?
      `).get(createCommand.id) as any

      const payload = JSON.parse(snapshot.payload)
      expect(payload.tags).toEqual([])
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when bundle not found', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const service = new UpdateBundleMetadataService(unitOfWork)

      await expect(service.execute({
        type: 'updateBundleMetadata',
        id: '01930000-0000-7000-8000-000000000099',
        userId: 'user-123',
        metaTitle: 'Title',
        metaDescription: 'Desc',
        tags: [],
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})

describe('UpdateBundlePriceService', () => {
  test('should successfully update bundle price', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      const service = new UpdateBundlePriceService(unitOfWork)
      await service.execute({
        type: 'updateBundlePrice',
        id: createCommand.id,
        userId: 'user-123',
        price: 199.99,
        compareAtPrice: 249.99,
        expectedVersion: 0,
      })

      const snapshot = db.query(`
        SELECT payload, version FROM snapshots WHERE aggregateId = ?
      `).get(createCommand.id) as any

      expect(snapshot.version).toBe(1)
      const payload = JSON.parse(snapshot.payload)
      expect(payload.price).toBe(199.99)
      expect(payload.compareAtPrice).toBe(249.99)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should allow null compareAtPrice', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      const service = new UpdateBundlePriceService(unitOfWork)
      await service.execute({
        type: 'updateBundlePrice',
        id: createCommand.id,
        userId: 'user-123',
        price: 49.99,
        compareAtPrice: null,
        expectedVersion: 0,
      })

      const snapshot = db.query(`
        SELECT payload FROM snapshots WHERE aggregateId = ?
      `).get(createCommand.id) as any

      const payload = JSON.parse(snapshot.payload)
      expect(payload.price).toBe(49.99)
      expect(payload.compareAtPrice).toBeNull()
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when bundle not found', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const service = new UpdateBundlePriceService(unitOfWork)

      await expect(service.execute({
        type: 'updateBundlePrice',
        id: '01930000-0000-7000-8000-000000000099',
        userId: 'user-123',
        price: 100,
        compareAtPrice: null,
        expectedVersion: 0,
      })).rejects.toThrow('not found')
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

      const service = new UpdateBundlePriceService(unitOfWork)

      await expect(service.execute({
        type: 'updateBundlePrice',
        id: createCommand.id,
        userId: 'user-123',
        price: 100,
        compareAtPrice: null,
        expectedVersion: 5,
      })).rejects.toThrow('concurrency')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})

describe('UpdateBundleTaxDetailsService', () => {
  test('should successfully update bundle tax details', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = createValidBundleCommand()
      await createBundleInDatabase(unitOfWork, createCommand)

      const service = new UpdateBundleTaxDetailsService(unitOfWork)
      await service.execute({
        type: 'updateBundleTaxDetails',
        id: createCommand.id,
        userId: 'user-123',
        taxable: false,
        taxId: 'NEW-TAX-ID',
        expectedVersion: 0,
      })

      const snapshot = db.query(`
        SELECT payload, version FROM snapshots WHERE aggregateId = ?
      `).get(createCommand.id) as any

      expect(snapshot.version).toBe(1)
      const payload = JSON.parse(snapshot.payload)
      expect(payload.taxable).toBe(false)
      expect(payload.taxId).toBe('NEW-TAX-ID')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should update taxable from false to true', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const createCommand = { ...createValidBundleCommand(), taxable: false }
      await createBundleInDatabase(unitOfWork, createCommand)

      const service = new UpdateBundleTaxDetailsService(unitOfWork)
      await service.execute({
        type: 'updateBundleTaxDetails',
        id: createCommand.id,
        userId: 'user-123',
        taxable: true,
        taxId: 'TAX-ABC',
        expectedVersion: 0,
      })

      const snapshot = db.query(`
        SELECT payload FROM snapshots WHERE aggregateId = ?
      `).get(createCommand.id) as any

      const payload = JSON.parse(snapshot.payload)
      expect(payload.taxable).toBe(true)
      expect(payload.taxId).toBe('TAX-ABC')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when bundle not found', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()
    try {
      const service = new UpdateBundleTaxDetailsService(unitOfWork)

      await expect(service.execute({
        type: 'updateBundleTaxDetails',
        id: '01930000-0000-7000-8000-000000000099',
        userId: 'user-123',
        taxable: true,
        taxId: '',
        expectedVersion: 0,
      })).rejects.toThrow('not found')
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

      const service = new UpdateBundleTaxDetailsService(unitOfWork)

      await expect(service.execute({
        type: 'updateBundleTaxDetails',
        id: createCommand.id,
        userId: 'user-123',
        taxable: false,
        taxId: '',
        expectedVersion: 99,
      })).rejects.toThrow('concurrency')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
