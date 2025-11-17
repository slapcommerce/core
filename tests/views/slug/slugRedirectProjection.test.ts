import { describe, test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { TransactionBatch } from '../../../src/infrastructure/transactionBatch'
import { slugRedirectProjection } from '../../../src/views/slug/slugRedirectProjection'
import { ProductSlugChangedEvent } from '../../../src/domain/product/events'
import { EventRepository } from '../../../src/infrastructure/repositories/eventRepository'
import { SnapshotRepository } from '../../../src/infrastructure/repositories/snapshotRepository'
import { OutboxRepository } from '../../../src/infrastructure/repositories/outboxRepository'
import { ProductListViewRepository } from '../../../src/infrastructure/repositories/productListViewRepository'
import { ProductCollectionRepository } from '../../../src/infrastructure/repositories/productCollectionRepository'
import { ProductVariantRepository } from '../../../src/infrastructure/repositories/productVariantRepository'
import { SlugRedirectRepository } from '../../../src/infrastructure/repositories/slugRedirectRepository'
import { CollectionsListViewRepository } from '../../../src/infrastructure/repositories/collectionsListViewRepository'
import { ScheduleViewRepository } from '../../../src/infrastructure/repositories/scheduleViewRepository'
import { schemas } from '../../../src/infrastructure/schemas'
import { randomUUIDv7 } from 'bun'
import type { UnitOfWorkRepositories } from '../../../src/infrastructure/projectionService'

function createProductState(overrides?: Partial<any>): any {
  return {
    title: 'Test Product',
    shortDescription: 'A test product',
    slug: overrides?.slug ?? 'test-product',
    collectionIds: [],
    variantIds: [randomUUIDv7()],
    richDescriptionUrl: 'https://example.com/description',
    productType: 'physical',
    vendor: 'Test Vendor',
    variantOptions: [{ name: 'Size', values: ['S', 'M', 'L'] }],
    metaTitle: 'Test Product Meta Title',
    metaDescription: 'Test Product Meta Description',
    tags: ['test', 'product'],
    requiresShipping: true,
    taxable: true,
    pageLayoutId: null,
    status: 'draft',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    publishedAt: null,
    ...overrides,
  }
}

function createRepositories(db: Database, batch: TransactionBatch): UnitOfWorkRepositories {
  return {
    eventRepository: new EventRepository(db, batch),
    snapshotRepository: new SnapshotRepository(db, batch),
    outboxRepository: new OutboxRepository(db, batch),
    productListViewRepository: new ProductListViewRepository(db, batch),
    productCollectionRepository: new ProductCollectionRepository(db, batch),
    productVariantRepository: new ProductVariantRepository(db, batch),
    slugRedirectRepository: new SlugRedirectRepository(db, batch),
    collectionsListViewRepository: new CollectionsListViewRepository(db, batch),
    scheduleViewRepository: new ScheduleViewRepository(db, batch),
  }
}

async function flushBatch(db: Database, batch: TransactionBatch): Promise<void> {
  try {
    db.run('BEGIN TRANSACTION')
    for (const command of batch.commands) {
      command.statement.run(...command.params)
    }
    db.run('COMMIT')
    batch.resolve()
  } catch (error) {
    try {
      db.run('ROLLBACK')
    } catch {
      // Ignore rollback errors
    }
    batch.reject(error instanceof Error ? error : new Error(String(error)))
    throw error
  }
}

describe('slugRedirectProjection', () => {
  test('should create redirect entry when product.slug_changed event is handled', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const productId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    const priorState = createProductState({ slug: 'old-slug' })
    const newState = createProductState({ slug: 'new-slug' })
    
    const event = new ProductSlugChangedEvent({
      occurredAt: new Date(),
      aggregateId: productId,
      correlationId,
      version: 1,
      userId: 'user-123',
      priorState,
      newState,
    })

    // Act
    await slugRedirectProjection(event, repositories)
    await flushBatch(db, batch)

    // Assert
    const redirect = db.query(
      'SELECT * FROM slug_redirects WHERE old_slug = ?'
    ).get('old-slug') as any
    
    expect(redirect).toBeDefined()
    expect(redirect.old_slug).toBe('old-slug')
    expect(redirect.new_slug).toBe('new-slug')
    expect(redirect.product_id).toBe(productId)
    
    db.close()
  })

  test('should append to existing redirects when multiple slug changes occur', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const productId1 = randomUUIDv7()
    const productId2 = randomUUIDv7()
    const correlationId1 = randomUUIDv7()
    const correlationId2 = randomUUIDv7()
    
    // First slug change
    const event1 = new ProductSlugChangedEvent({
      occurredAt: new Date('2024-01-01'),
      aggregateId: productId1,
      correlationId: correlationId1,
      version: 1,
      userId: 'user-123',
      priorState: createProductState({ slug: 'slug-a' }),
      newState: createProductState({ slug: 'slug-b' }),
    })
    
    await slugRedirectProjection(event1, repositories)
    await flushBatch(db, batch)
    
    // Second slug change for different product
    const batch2 = new TransactionBatch()
    const repositories2 = createRepositories(db, batch2)
    const event2 = new ProductSlugChangedEvent({
      occurredAt: new Date('2024-01-02'),
      aggregateId: productId2,
      correlationId: correlationId2,
      version: 1,
      userId: 'user-123',
      priorState: createProductState({ slug: 'slug-x' }),
      newState: createProductState({ slug: 'slug-y' }),
    })

    // Act
    await slugRedirectProjection(event2, repositories2)
    await flushBatch(db, batch2)

    // Assert
    const redirects = db.query('SELECT * FROM slug_redirects').all() as any[]
    expect(redirects).toHaveLength(2)
    
    const redirectA = redirects.find((r: any) => r.old_slug === 'slug-a')
    expect(redirectA).toBeDefined()
    expect(redirectA.new_slug).toBe('slug-b')
    
    const redirectX = redirects.find((r: any) => r.old_slug === 'slug-x')
    expect(redirectX).toBeDefined()
    expect(redirectX.new_slug).toBe('slug-y')
    
    db.close()
  })

  test('should chain redirects when new slug matches existing old slug', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const productId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    
    // First redirect: A -> B
    const event1 = new ProductSlugChangedEvent({
      occurredAt: new Date('2024-01-01'),
      aggregateId: productId,
      correlationId,
      version: 1,
      userId: 'user-123',
      priorState: createProductState({ slug: 'slug-a' }),
      newState: createProductState({ slug: 'slug-b' }),
    })
    
    await slugRedirectProjection(event1, repositories)
    await flushBatch(db, batch)
    
    // Second redirect: B -> C (should chain A -> C)
    const batch2 = new TransactionBatch()
    const repositories2 = createRepositories(db, batch2)
    const event2 = new ProductSlugChangedEvent({
      occurredAt: new Date('2024-01-02'),
      aggregateId: productId,
      correlationId,
      version: 2,
      userId: 'user-123',
      priorState: createProductState({ slug: 'slug-b' }),
      newState: createProductState({ slug: 'slug-c' }),
    })

    // Act
    await slugRedirectProjection(event2, repositories2)
    await flushBatch(db, batch2)

    // Assert
    const redirects = db.query('SELECT * FROM slug_redirects').all() as any[]
    expect(redirects).toHaveLength(2)
    
    // First redirect should be chained: A -> C
    const redirectA = redirects.find((r: any) => r.old_slug === 'slug-a')
    expect(redirectA).toBeDefined()
    expect(redirectA.new_slug).toBe('slug-c')
    
    // Second redirect should be: B -> C
    const redirectB = redirects.find((r: any) => r.old_slug === 'slug-b')
    expect(redirectB).toBeDefined()
    expect(redirectB.new_slug).toBe('slug-c')
    
    db.close()
  })

  test('should chain multiple redirects correctly', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const productId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    
    // Create chain: A -> B -> C -> D
    const events = [
      { old: 'slug-a', new: 'slug-b' },
      { old: 'slug-b', new: 'slug-c' },
      { old: 'slug-c', new: 'slug-d' },
    ]
    
    for (let i = 0; i < events.length; i++) {
      const entry = events[i]!
      const event = new ProductSlugChangedEvent({
        occurredAt: new Date(`2024-01-0${i + 1}`),
        aggregateId: productId,
        correlationId,
        version: i + 1,
        userId: 'user-123',
        priorState: createProductState({ slug: entry.old }),
        newState: createProductState({ slug: entry.new }),
      })
      
      const batch = new TransactionBatch()
      const repos = createRepositories(db, batch)
      await slugRedirectProjection(event, repos)
      await flushBatch(db, batch)
    }

    // Act - Verify final state
    const redirects = db.query('SELECT * FROM slug_redirects').all() as any[]

    // Assert - All redirects should chain to final destination
    expect(redirects).toHaveLength(3)
    
    const redirectA = redirects.find((r: any) => r.old_slug === 'slug-a')
    expect(redirectA.new_slug).toBe('slug-d') // A -> D
    
    const redirectB = redirects.find((r: any) => r.old_slug === 'slug-b')
    expect(redirectB.new_slug).toBe('slug-d') // B -> D
    
    const redirectC = redirects.find((r: any) => r.old_slug === 'slug-c')
    expect(redirectC.new_slug).toBe('slug-d') // C -> D
    
    db.close()
  })

  test('should handle redirects for different products independently', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const productId1 = randomUUIDv7()
    const productId2 = randomUUIDv7()
    const correlationId1 = randomUUIDv7()
    const correlationId2 = randomUUIDv7()
    
    // Product 1: A -> B
    const event1 = new ProductSlugChangedEvent({
      occurredAt: new Date('2024-01-01'),
      aggregateId: productId1,
      correlationId: correlationId1,
      version: 1,
      userId: 'user-123',
      priorState: createProductState({ slug: 'product1-a' }),
      newState: createProductState({ slug: 'product1-b' }),
    })
    
    await slugRedirectProjection(event1, repositories)
    await flushBatch(db, batch)
    
    // Product 2: X -> Y (should not chain with product 1)
    const batch2 = new TransactionBatch()
    const repositories2 = createRepositories(db, batch2)
    const event2 = new ProductSlugChangedEvent({
      occurredAt: new Date('2024-01-02'),
      aggregateId: productId2,
      correlationId: correlationId2,
      version: 1,
      userId: 'user-123',
      priorState: createProductState({ slug: 'product2-x' }),
      newState: createProductState({ slug: 'product2-y' }),
    })

    // Act
    await slugRedirectProjection(event2, repositories2)
    await flushBatch(db, batch2)

    // Assert
    const redirects = db.query('SELECT * FROM slug_redirects').all() as any[]
    expect(redirects).toHaveLength(2)
    
    const redirect1 = redirects.find((r: any) => r.product_id === productId1)
    expect(redirect1).toBeDefined()
    expect(redirect1.old_slug).toBe('product1-a')
    expect(redirect1.new_slug).toBe('product1-b')
    
    const redirect2 = redirects.find((r: any) => r.product_id === productId2)
    expect(redirect2).toBeDefined()
    expect(redirect2.old_slug).toBe('product2-x')
    expect(redirect2.new_slug).toBe('product2-y')
    
    db.close()
  })

  test('should reuse existing projection ID when updating', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const productId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    
    // First redirect
    const event1 = new ProductSlugChangedEvent({
      occurredAt: new Date('2024-01-01'),
      aggregateId: productId,
      correlationId,
      version: 1,
      userId: 'user-123',
      priorState: createProductState({ slug: 'slug-a' }),
      newState: createProductState({ slug: 'slug-b' }),
    })
    
    await slugRedirectProjection(event1, repositories)
    await flushBatch(db, batch)
    
    const firstRedirects = db.query('SELECT * FROM slug_redirects').all() as any[]
    expect(firstRedirects).toHaveLength(1)
    
    // Second redirect
    const batch2 = new TransactionBatch()
    const repositories2 = createRepositories(db, batch2)
    const event2 = new ProductSlugChangedEvent({
      occurredAt: new Date('2024-01-02'),
      aggregateId: productId,
      correlationId,
      version: 2,
      userId: 'user-123',
      priorState: createProductState({ slug: 'slug-b' }),
      newState: createProductState({ slug: 'slug-c' }),
    })

    // Act
    await slugRedirectProjection(event2, repositories2)
    await flushBatch(db, batch2)

    // Assert - Should have 2 redirects now (A->C and B->C)
    const secondRedirects = db.query('SELECT * FROM slug_redirects').all() as any[]
    expect(secondRedirects).toHaveLength(2)
    
    db.close()
  })

  test('should handle multiple redirects for same product', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const productId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    
    // Create multiple redirects for same product
    const redirectEntries = [
      { old: 'slug-1', new: 'slug-2' },
      { old: 'slug-3', new: 'slug-4' },
      { old: 'slug-5', new: 'slug-6' },
    ]
    
    for (let i = 0; i < redirectEntries.length; i++) {
      const entry = redirectEntries[i]!
      const event = new ProductSlugChangedEvent({
        occurredAt: new Date(`2024-01-0${i + 1}`),
        aggregateId: productId,
        correlationId,
        version: i + 1,
        userId: 'user-123',
        priorState: createProductState({ slug: entry.old }),
        newState: createProductState({ slug: entry.new }),
      })
      
      const batch = new TransactionBatch()
      const repos = createRepositories(db, batch)
      await slugRedirectProjection(event, repos)
      await flushBatch(db, batch)
    }

    // Act - Verify all redirects exist
    const redirects = db.query('SELECT * FROM slug_redirects').all() as any[]

    // Assert
    expect(redirects).toHaveLength(3)
    expect(redirects.every((r: any) => r.product_id === productId)).toBe(true)
    
    db.close()
  })

  test('should ignore unknown event types', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const unknownEvent = {
      eventName: 'unknown.event',
      aggregateId: randomUUIDv7(),
      correlationId: randomUUIDv7(),
      version: 0,
      occurredAt: new Date(),
      payload: {},
    } as any

    // Act & Assert - Should not throw
    await slugRedirectProjection(unknownEvent, repositories)
    await flushBatch(db, batch)

    // Assert - No redirects should be created
    const redirects = db.query('SELECT * FROM slug_redirects').all() as any[]
    expect(redirects).toHaveLength(0)
    
    db.close()
  })

  test('should handle edge case where old slug equals new slug', async () => {
    // Arrange
    const db = new Database(':memory:')
    for (const schema of schemas) {
      db.run(schema)
    }
    const batch = new TransactionBatch()
    const repositories = createRepositories(db, batch)
    
    const productId = randomUUIDv7()
    const correlationId = randomUUIDv7()
    
    // Edge case: old slug == new slug (shouldn't happen in practice, but handle gracefully)
    const event = new ProductSlugChangedEvent({
      occurredAt: new Date(),
      aggregateId: productId,
      correlationId,
      version: 1,
      userId: 'user-123',
      priorState: createProductState({ slug: 'same-slug' }),
      newState: createProductState({ slug: 'same-slug' }),
    })

    // Act
    await slugRedirectProjection(event, repositories)
    await flushBatch(db, batch)

    // Assert - Should still create redirect entry
    const redirects = db.query('SELECT * FROM slug_redirects').all() as any[]
    expect(redirects).toHaveLength(1)
    expect(redirects[0].old_slug).toBe('same-slug')
    expect(redirects[0].new_slug).toBe('same-slug')
    
    db.close()
  })
})

