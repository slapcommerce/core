import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { randomUUIDv7 } from 'bun'
import { CreateProductService } from '../../../src/app/product/createProductService'
import { ChangeSlugService } from '../../../src/app/product/changeSlugService'
import { UnitOfWork } from '../../../src/infrastructure/unitOfWork'
import { TransactionBatcher } from '../../../src/infrastructure/transactionBatcher'
import { schemas } from '../../../src/infrastructure/schemas'
import { ProjectionService } from '../../../src/infrastructure/projectionService'
import { productListViewProjection } from '../../../src/views/product/productListViewProjection'
import { slugRedirectProjection } from '../../../src/views/slug/slugRedirectProjection'
import type { CreateProductCommand } from '../../../src/app/product/commands'
import type { ChangeSlugCommand } from '../../../src/app/product/commands'

function createValidCommand(overrides?: Partial<CreateProductCommand>): CreateProductCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    correlationId: overrides?.correlationId ?? randomUUIDv7(),
    title: overrides?.title ?? 'Test Product',
    shortDescription: overrides?.shortDescription ?? 'A test product',
    slug: overrides?.slug ?? 'test-product',
    collectionIds: overrides?.collectionIds ?? [randomUUIDv7()],
    variantIds: overrides?.variantIds ?? [randomUUIDv7()],
    richDescriptionUrl: overrides?.richDescriptionUrl ?? 'https://example.com/description',
    productType: overrides?.productType ?? 'physical',
    vendor: overrides?.vendor ?? 'Test Vendor',
    variantOptions: overrides?.variantOptions ?? [
      { name: 'Size', values: ['S', 'M', 'L'] }
    ],
    metaTitle: overrides?.metaTitle ?? 'Test Product Meta Title',
    metaDescription: overrides?.metaDescription ?? 'Test Product Meta Description',
    tags: overrides?.tags ?? ['test', 'product'],
    requiresShipping: overrides?.requiresShipping ?? true,
    taxable: overrides?.taxable ?? true,
    pageLayoutId: overrides?.pageLayoutId ?? null,
  }
}

function createChangeSlugCommand(overrides?: Partial<ChangeSlugCommand>): ChangeSlugCommand {
  return {
    id: overrides?.id ?? randomUUIDv7(),
    newSlug: overrides?.newSlug ?? 'new-slug',
    expectedVersion: overrides?.expectedVersion ?? 0,
  }
}

describe('ChangeSlugService', () => {
  test('should successfully change a product slug', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    const unitOfWork = new UnitOfWork(db, batcher)
    const projectionService = new ProjectionService()
    projectionService.registerHandler('product.created', productListViewProjection)
    projectionService.registerHandler('product.slug_changed', slugRedirectProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const changeSlugService = new ChangeSlugService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand({ slug: 'old-slug' })
    await createService.execute(createCommand)

    // Wait for batch to flush to ensure snapshot is persisted
    await new Promise(resolve => setTimeout(resolve, 100))

    const changeSlugCommand = createChangeSlugCommand({
      id: createCommand.id,
      newSlug: 'new-slug',
      expectedVersion: 0,
    })

    // Act
    await changeSlugService.execute(changeSlugCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert - Verify slug changed event was saved
    const events = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all(createCommand.id) as any[]
    expect(events.length).toBe(2)
    expect(events[0]!.event_type).toBe('product.created')
    expect(events[1]!.event_type).toBe('product.slug_changed')
    expect(events[1]!.version).toBe(1)

    const slugChangedPayload = JSON.parse(events[1]!.payload)
    expect(slugChangedPayload.priorState.slug).toBe('old-slug')
    expect(slugChangedPayload.newState.slug).toBe('new-slug')

    // Assert - Verify snapshot was updated
    const snapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get(createCommand.id) as any
    expect(snapshot).toBeDefined()
    expect(snapshot.version).toBe(1)
    
    const snapshotPayload = JSON.parse(snapshot.payload)
    expect(snapshotPayload.slug).toBe('new-slug')

    // Assert - Verify slug aggregates were updated
    const newSlugSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get('new-slug') as any
    expect(newSlugSnapshot).toBeDefined()
    const newSlugPayload = JSON.parse(newSlugSnapshot.payload)
    expect(newSlugPayload.productId).toBe(createCommand.id)
    expect(newSlugPayload.status).toBe('active')
    
    const oldSlugSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get('old-slug') as any
    expect(oldSlugSnapshot).toBeDefined()
    const oldSlugPayload = JSON.parse(oldSlugSnapshot.payload)
    expect(oldSlugPayload.status).toBe('redirect')
    expect(oldSlugPayload.productId).toBe(createCommand.id) // ProductId should still be set for redirect

    // Assert - Verify redirect projection was created
    const redirectProjection = db.query('SELECT * FROM projections WHERE projection_type = ? AND aggregate_id = ?').get('slug_redirect', 'slug-redirects') as any
    expect(redirectProjection).toBeDefined()
    const redirectPayload = JSON.parse(redirectProjection.payload)
    expect(redirectPayload.redirects).toBeDefined()
    expect(redirectPayload.redirects.length).toBe(1)
    expect(redirectPayload.redirects[0]!.oldSlug).toBe('old-slug')
    expect(redirectPayload.redirects[0]!.newSlug).toBe('new-slug')
    expect(redirectPayload.redirects[0]!.productId).toBe(createCommand.id)

    batcher.stop()
    db.close()
  })

  test('should throw error if slug is already in use', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    const unitOfWork = new UnitOfWork(db, batcher)
    const projectionService = new ProjectionService()
    projectionService.registerHandler('product.created', productListViewProjection)
    projectionService.registerHandler('product.slug_changed', slugRedirectProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const changeSlugService = new ChangeSlugService(unitOfWork, projectionService)
    
    const createCommand1 = createValidCommand({ slug: 'existing-slug' })
    const createCommand2 = createValidCommand({ slug: 'other-slug' })
    await createService.execute(createCommand1)
    await createService.execute(createCommand2)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const changeSlugCommand = createChangeSlugCommand({
      id: createCommand2.id,
      newSlug: 'existing-slug', // Try to use slug from product 1
      expectedVersion: 0,
    })

    // Act & Assert
    await expect(changeSlugService.execute(changeSlugCommand)).rejects.toThrow('Slug "existing-slug" is already in use')

    batcher.stop()
    db.close()
  })

  test('should throw error on optimistic concurrency conflict', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    const unitOfWork = new UnitOfWork(db, batcher)
    const projectionService = new ProjectionService()
    projectionService.registerHandler('product.created', productListViewProjection)
    projectionService.registerHandler('product.slug_changed', slugRedirectProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const changeSlugService = new ChangeSlugService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand({ slug: 'old-slug' })
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const changeSlugCommand = createChangeSlugCommand({
      id: createCommand.id,
      newSlug: 'new-slug',
      expectedVersion: 999, // Wrong version
    })

    // Act & Assert
    await expect(changeSlugService.execute(changeSlugCommand)).rejects.toThrow('Optimistic concurrency conflict')

    batcher.stop()
    db.close()
  })

  test('should throw error if product not found', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    const unitOfWork = new UnitOfWork(db, batcher)
    const projectionService = new ProjectionService()
    projectionService.registerHandler('product.slug_changed', slugRedirectProjection)
    const changeSlugService = new ChangeSlugService(unitOfWork, projectionService)
    
    const changeSlugCommand = createChangeSlugCommand({
      id: randomUUIDv7(), // Non-existent product
      newSlug: 'new-slug',
      expectedVersion: 0,
    })

    // Act & Assert
    await expect(changeSlugService.execute(changeSlugCommand)).rejects.toThrow('not found')

    batcher.stop()
    db.close()
  })

  test('should throw error if new slug is same as current slug', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    const unitOfWork = new UnitOfWork(db, batcher)
    const projectionService = new ProjectionService()
    projectionService.registerHandler('product.created', productListViewProjection)
    projectionService.registerHandler('product.slug_changed', slugRedirectProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const changeSlugService = new ChangeSlugService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand({ slug: 'same-slug' })
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    const changeSlugCommand = createChangeSlugCommand({
      id: createCommand.id,
      newSlug: 'same-slug', // Same as current
      expectedVersion: 0,
    })

    // Act & Assert
    await expect(changeSlugService.execute(changeSlugCommand)).rejects.toThrow('New slug must be different from current slug')

    batcher.stop()
    db.close()
  })

  test('should chain redirects correctly', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    const unitOfWork = new UnitOfWork(db, batcher)
    const projectionService = new ProjectionService()
    projectionService.registerHandler('product.created', productListViewProjection)
    projectionService.registerHandler('product.slug_changed', slugRedirectProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const changeSlugService = new ChangeSlugService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand({ slug: 'slug-a' })
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Change slug A -> B
    const changeSlugCommand1 = createChangeSlugCommand({
      id: createCommand.id,
      newSlug: 'slug-b',
      expectedVersion: 0,
    })
    await changeSlugService.execute(changeSlugCommand1)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Change slug B -> C
    const changeSlugCommand2 = createChangeSlugCommand({
      id: createCommand.id,
      newSlug: 'slug-c',
      expectedVersion: 1,
    })
    await changeSlugService.execute(changeSlugCommand2)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert - Verify redirect projection chains correctly
    const redirectProjection = db.query('SELECT * FROM projections WHERE projection_type = ? AND aggregate_id = ?').get('slug_redirect', 'slug-redirects') as any
    expect(redirectProjection).toBeDefined()
    const redirectPayload = JSON.parse(redirectProjection.payload)
    expect(redirectPayload.redirects).toBeDefined()
    
    // Should have A->C and B->C (A->B should be updated to A->C)
    const redirects = redirectPayload.redirects as Array<{ oldSlug: string; newSlug: string; productId: string }>
    expect(redirects.length).toBe(2)
    
    const redirectA = redirects.find(r => r.oldSlug === 'slug-a')
    expect(redirectA).toBeDefined()
    expect(redirectA!.newSlug).toBe('slug-c') // Should chain to C
    
    const redirectB = redirects.find(r => r.oldSlug === 'slug-b')
    expect(redirectB).toBeDefined()
    expect(redirectB!.newSlug).toBe('slug-c')

    batcher.stop()
    db.close()
  })

  test('should mark old slug as redirected and reserve new slug', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    const unitOfWork = new UnitOfWork(db, batcher)
    const projectionService = new ProjectionService()
    projectionService.registerHandler('product.created', productListViewProjection)
    projectionService.registerHandler('product.slug_changed', slugRedirectProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const changeSlugService = new ChangeSlugService(unitOfWork, projectionService)
    
    const createCommand = createValidCommand({ slug: 'old-slug' })
    await createService.execute(createCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify old slug is reserved and active
    const oldSlugSnapshotBefore = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get('old-slug') as any
    expect(oldSlugSnapshotBefore).toBeDefined()
    const oldSlugPayloadBefore = JSON.parse(oldSlugSnapshotBefore.payload)
    expect(oldSlugPayloadBefore.productId).toBe(createCommand.id)
    expect(oldSlugPayloadBefore.status).toBe('active')

    const changeSlugCommand = createChangeSlugCommand({
      id: createCommand.id,
      newSlug: 'new-slug',
      expectedVersion: 0,
    })
    await changeSlugService.execute(changeSlugCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Assert - Verify slug aggregate events
    const newSlugEvents = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all('new-slug') as any[]
    expect(newSlugEvents.length).toBeGreaterThanOrEqual(1)
    const newSlugReservedEvents = newSlugEvents.filter(e => e.event_type === 'slug.reserved')
    expect(newSlugReservedEvents.length).toBeGreaterThanOrEqual(1)
    
    const oldSlugEvents = db.query('SELECT * FROM events WHERE aggregate_id = ? ORDER BY version ASC').all('old-slug') as any[]
    expect(oldSlugEvents.length).toBeGreaterThanOrEqual(1)
    const oldSlugRedirectedEvents = oldSlugEvents.filter(e => e.event_type === 'slug.redirected')
    expect(oldSlugRedirectedEvents.length).toBeGreaterThanOrEqual(1)
    
    // Verify redirected event payload
    const redirectedEventPayload = JSON.parse(oldSlugRedirectedEvents[0]!.payload)
    expect(redirectedEventPayload.priorState.status).toBe('active')
    expect(redirectedEventPayload.newState.status).toBe('redirect')

    // Verify final state
    const newSlugSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get('new-slug') as any
    expect(newSlugSnapshot).toBeDefined()
    const newSlugPayload = JSON.parse(newSlugSnapshot.payload)
    expect(newSlugPayload.productId).toBe(createCommand.id)
    expect(newSlugPayload.status).toBe('active')
    
    const oldSlugSnapshot = db.query('SELECT * FROM snapshots WHERE aggregate_id = ?').get('old-slug') as any
    expect(oldSlugSnapshot).toBeDefined()
    const oldSlugPayload = JSON.parse(oldSlugSnapshot.payload)
    expect(oldSlugPayload.productId).toBe(createCommand.id) // ProductId should still be set
    expect(oldSlugPayload.status).toBe('redirect')

    batcher.stop()
    db.close()
  })

  test('should not allow reserving a redirected slug', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }

    const batcher = new TransactionBatcher(db, {
      flushIntervalMs: 50,
      batchSizeThreshold: 10,
      maxQueueDepth: 100
    })
    batcher.start()

    const unitOfWork = new UnitOfWork(db, batcher)
    const projectionService = new ProjectionService()
    projectionService.registerHandler('product.created', productListViewProjection)
    projectionService.registerHandler('product.slug_changed', slugRedirectProjection)
    const createService = new CreateProductService(unitOfWork, projectionService)
    const changeSlugService = new ChangeSlugService(unitOfWork, projectionService)
    
    const createCommand1 = createValidCommand({ slug: 'original-slug' })
    await createService.execute(createCommand1)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Change slug to make original-slug redirected
    const changeSlugCommand = createChangeSlugCommand({
      id: createCommand1.id,
      newSlug: 'new-slug',
      expectedVersion: 0,
    })
    await changeSlugService.execute(changeSlugCommand)

    // Wait for batch to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Try to create a new product with the redirected slug
    const createCommand2 = createValidCommand({ slug: 'original-slug' })

    // Act & Assert
    await expect(createService.execute(createCommand2)).rejects.toThrow('Slug "original-slug" is already in use')

    batcher.stop()
    db.close()
  })
})

