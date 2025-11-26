import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createTestDatabase, closeTestDatabase } from '../../../../../helpers/database'
import { TransactionBatcher } from '../../../../../../src/api/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../../../../src/api/infrastructure/unitOfWork'
import { ChangeSlugService } from '../../../../../../src/api/app/product/commands/admin/changeSlugService'
import { ProductAggregate } from '../../../../../../src/api/domain/product/aggregate'
import { SlugAggregate } from '../../../../../../src/api/domain/slug/slugAggregate'
import type { ChangeSlugCommand } from '../../../../../../src/api/app/product/commands/admin/commands'

function createValidProductParams() {
  return {
    id: 'product-123',
    correlationId: 'correlation-123',
    userId: 'user-123',
    title: 'Test Product',
    shortDescription: 'A test product',
    slug: 'old-slug',
    collectionIds: ['collection-1'],
    variantIds: ['variant-1'],
    richDescriptionUrl: 'https://example.com/description',
    productType: 'physical',
    fulfillmentType: 'digital' as const,
    vendor: 'Test Vendor',
    variantOptions: [{ name: 'Size', values: ['S', 'M', 'L'] }],
    metaTitle: 'Test Product Meta',
    metaDescription: 'Test product description',
    tags: ['tag1', 'tag2'],
    taxable: true,
    taxId: 'TAX123',
    dropshipSafetyBuffer: 2,
  }
}

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

async function createProductWithSlugInDatabase(unitOfWork: UnitOfWork, params: ReturnType<typeof createValidProductParams>) {
  await unitOfWork.withTransaction(async ({ snapshotRepository, eventRepository, outboxRepository }) => {
    // Create product
    const product = ProductAggregate.create(params)

    snapshotRepository.saveSnapshot({
      aggregateId: product.id,
      correlationId: params.correlationId,
      version: product.version,
      payload: product.toSnapshot(),
    })

    for (const event of product.uncommittedEvents) {
      eventRepository.addEvent(event)
      outboxRepository.addOutboxEvent(event, { id: crypto.randomUUID() })
    }

    // Create slug aggregate
    const slugAggregate = SlugAggregate.create({
      slug: params.slug,
      correlationId: params.correlationId,
    })
    slugAggregate.reserveSlug(params.id, params.userId)

    snapshotRepository.saveSnapshot({
      aggregateId: slugAggregate.id,
      correlationId: params.correlationId,
      version: slugAggregate.version,
      payload: slugAggregate.toSnapshot(),
    })

    for (const event of slugAggregate.uncommittedEvents) {
      eventRepository.addEvent(event)
      outboxRepository.addOutboxEvent(event, { id: crypto.randomUUID() })
    }
  })
}

async function reserveSlugInDatabase(unitOfWork: UnitOfWork, slug: string, targetId: string, userId: string) {
  await unitOfWork.withTransaction(async ({ snapshotRepository, eventRepository, outboxRepository }) => {
    const slugAggregate = SlugAggregate.create({
      slug,
      correlationId: 'test-correlation',
    })
    slugAggregate.reserveSlug(targetId, userId)

    snapshotRepository.saveSnapshot({
      aggregateId: slugAggregate.id,
      correlationId: 'test-correlation',
      version: slugAggregate.version,
      payload: slugAggregate.toSnapshot(),
    })

    for (const event of slugAggregate.uncommittedEvents) {
      eventRepository.addEvent(event)
      outboxRepository.addOutboxEvent(event, { id: crypto.randomUUID() })
    }
  })
}

describe('ChangeSlugService', () => {
  test('should successfully change product slug', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      await createProductWithSlugInDatabase(unitOfWork, productParams)

      const service = new ChangeSlugService(unitOfWork)
      const command: ChangeSlugCommand = {
        type: 'changeSlug',
        id: productParams.id,
        newSlug: 'new-slug',
        userId: 'user-456',
        expectedVersion: 0,
      }

      // Act
      await service.execute(command)

      // Assert - Verify product snapshot was updated
      const productSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregate_id = ?
        ORDER BY version DESC
        LIMIT 1
      `).get(productParams.id) as any

      expect(productSnapshot).not.toBeNull()
      expect(productSnapshot.version).toBe(1)
      const productPayload = JSON.parse(productSnapshot.payload)
      expect(productPayload.slug).toBe('new-slug')

      // Verify new slug was created and reserved
      const newSlugSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregate_id = ?
      `).get('new-slug') as any

      expect(newSlugSnapshot).not.toBeNull()
      const newSlugPayload = JSON.parse(newSlugSnapshot.payload)
      expect(newSlugPayload.productId).toBe(productParams.id)
      expect(newSlugPayload.status).toBe('active')

      // Verify old slug was marked as redirect
      const oldSlugSnapshot = db.query(`
        SELECT * FROM snapshots
        WHERE aggregate_id = ?
        ORDER BY version DESC
        LIMIT 1
      `).get('old-slug') as any

      expect(oldSlugSnapshot).not.toBeNull()
      const oldSlugPayload = JSON.parse(oldSlugSnapshot.payload)
      expect(oldSlugPayload.status).toBe('redirect')

      // Verify outbox entries were created
      const outboxEvents = db.query(`
        SELECT COUNT(*) as count FROM outbox
        WHERE aggregate_id IN (?, ?, ?)
      `).get(productParams.id, 'new-slug', 'old-slug') as any

      expect(outboxEvents.count).toBeGreaterThan(0)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when product not found', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new ChangeSlugService(unitOfWork)
      const command: ChangeSlugCommand = {
        type: 'changeSlug',
        id: 'non-existent-product',
        newSlug: 'new-slug',
        userId: 'user-456',
        expectedVersion: 0,
      }

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow('Product with id non-existent-product not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when new slug is already in use', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      await createProductWithSlugInDatabase(unitOfWork, productParams)

      // Reserve the new slug for a different product
      await reserveSlugInDatabase(unitOfWork, 'new-slug', 'other-product-id', 'user-789')

      const service = new ChangeSlugService(unitOfWork)
      const command: ChangeSlugCommand = {
        type: 'changeSlug',
        id: productParams.id,
        newSlug: 'new-slug',
        userId: 'user-456',
        expectedVersion: 0,
      }

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow('Slug "new-slug" is already in use')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error when new slug is same as current slug', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      await createProductWithSlugInDatabase(unitOfWork, productParams)

      const service = new ChangeSlugService(unitOfWork)
      const command: ChangeSlugCommand = {
        type: 'changeSlug',
        id: productParams.id,
        newSlug: 'old-slug', // Same as current slug
        userId: 'user-456',
        expectedVersion: 0,
      }

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow('New slug must be different from current slug')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw error on optimistic concurrency conflict', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      await createProductWithSlugInDatabase(unitOfWork, productParams)

      const service = new ChangeSlugService(unitOfWork)
      const command: ChangeSlugCommand = {
        type: 'changeSlug',
        id: productParams.id,
        newSlug: 'new-slug',
        userId: 'user-456',
        expectedVersion: 5, // Wrong version - product is at version 0
      }

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow('Optimistic concurrency conflict: expected version 5 but found version 0')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should increment version correctly', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      await createProductWithSlugInDatabase(unitOfWork, productParams)

      const service = new ChangeSlugService(unitOfWork)
      const command: ChangeSlugCommand = {
        type: 'changeSlug',
        id: productParams.id,
        newSlug: 'new-slug',
        userId: 'user-456',
        expectedVersion: 0,
      }

      // Act
      await service.execute(command)

      // Assert
      const updatedSnapshot = db.query(`
        SELECT version FROM snapshots
        WHERE aggregate_id = ?
        ORDER BY version DESC
        LIMIT 1
      `).get(productParams.id) as any

      expect(updatedSnapshot.version).toBe(1)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should preserve other product fields when changing slug', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      await createProductWithSlugInDatabase(unitOfWork, productParams)

      const service = new ChangeSlugService(unitOfWork)
      const command: ChangeSlugCommand = {
        type: 'changeSlug',
        id: productParams.id,
        newSlug: 'new-slug',
        userId: 'user-456',
        expectedVersion: 0,
      }

      // Act
      await service.execute(command)

      // Assert
      const updatedSnapshot = db.query(`
        SELECT payload FROM snapshots
        WHERE aggregate_id = ?
        ORDER BY version DESC
        LIMIT 1
      `).get(productParams.id) as any

      const payload = JSON.parse(updatedSnapshot.payload)
      expect(payload.title).toBe(productParams.title)
      expect(payload.vendor).toBe(productParams.vendor)
      expect(payload.productType).toBe(productParams.productType)
      expect(payload.taxable).toBe(productParams.taxable)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should create all three snapshots: product, new slug, and old slug', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      await createProductWithSlugInDatabase(unitOfWork, productParams)

      const service = new ChangeSlugService(unitOfWork)
      const command: ChangeSlugCommand = {
        type: 'changeSlug',
        id: productParams.id,
        newSlug: 'new-slug',
        userId: 'user-456',
        expectedVersion: 0,
      }

      // Act
      await service.execute(command)

      // Assert - Check all three snapshots exist
      const productSnapshot = db.query(`
        SELECT * FROM snapshots WHERE aggregate_id = ?
      `).get(productParams.id)
      expect(productSnapshot).not.toBeNull()

      const newSlugSnapshot = db.query(`
        SELECT * FROM snapshots WHERE aggregate_id = ?
      `).get('new-slug')
      expect(newSlugSnapshot).not.toBeNull()

      const oldSlugSnapshot = db.query(`
        SELECT * FROM snapshots WHERE aggregate_id = ?
      `).get('old-slug')
      expect(oldSlugSnapshot).not.toBeNull()
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should rollback on error and not create any new data', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const productParams = createValidProductParams()
      await createProductWithSlugInDatabase(unitOfWork, productParams)

      // Reserve the new slug
      await reserveSlugInDatabase(unitOfWork, 'new-slug', 'other-product-id', 'user-789')

      // Get initial counts
      const initialSnapshotCount = db.query(`
        SELECT COUNT(*) as count FROM snapshots
      `).get() as any

      const initialEventCount = db.query(`
        SELECT COUNT(*) as count FROM events
      `).get() as any

      const service = new ChangeSlugService(unitOfWork)
      const command: ChangeSlugCommand = {
        type: 'changeSlug',
        id: productParams.id,
        newSlug: 'new-slug',
        userId: 'user-456',
        expectedVersion: 0,
      }

      // Act & Assert
      await expect(service.execute(command)).rejects.toThrow()

      // Verify counts didn't increase (transaction rolled back)
      const finalSnapshotCount = db.query(`
        SELECT COUNT(*) as count FROM snapshots
      `).get() as any

      const finalEventCount = db.query(`
        SELECT COUNT(*) as count FROM events
      `).get() as any

      expect(finalSnapshotCount.count).toBe(initialSnapshotCount.count)
      expect(finalEventCount.count).toBe(initialEventCount.count)
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should set correct access level', async () => {
    // Arrange
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new ChangeSlugService(unitOfWork)

      // Assert
      expect(service.accessLevel).toBe('admin')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
