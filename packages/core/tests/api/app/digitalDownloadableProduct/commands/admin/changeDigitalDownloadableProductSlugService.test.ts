import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { ChangeDigitalDownloadableProductSlugService } from '../../../../../../src/api/app/digitalDownloadableProduct/commands/admin/changeDigitalDownloadableProductSlugService'
import { SlugAggregate } from '../../../../../../src/api/domain/slug/slugAggregate'
import { setupTestEnvironment, createTestProduct } from './helpers'
import { UnitOfWork } from '../../../../../../src/api/infrastructure/unitOfWork'

async function reserveSlugInDatabase(unitOfWork: UnitOfWork, slug: string, targetId: string, userId: string) {
  await unitOfWork.withTransaction(async ({ snapshotRepository, eventRepository, outboxRepository }) => {
    const slugAggregate = SlugAggregate.create({
      slug,
      correlationId: 'test-correlation',
    })
    slugAggregate.reserveSlug(targetId, 'digital_downloadable_product', userId)

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

describe('ChangeDigitalDownloadableProductSlugService', () => {
  test('should change product slug', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new ChangeDigitalDownloadableProductSlugService(unitOfWork)

      await service.execute({
        type: 'changeDigitalDownloadableProductSlug',
        id: product.id,
        userId: 'user-123',
        newSlug: 'new-slug',
        expectedVersion: 0,
      })

      const snapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(product.id) as any
      const payload = JSON.parse(snapshot.payload)
      expect(payload.slug).toBe('new-slug')

      // Verify new slug is reserved
      const newSlugSnapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get('new-slug') as any
      const newSlugPayload = JSON.parse(newSlugSnapshot.payload)
      expect(newSlugPayload.entityId).toBe(product.id)
      expect(newSlugPayload.status).toBe('active')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw if new slug is already in use', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      await reserveSlugInDatabase(unitOfWork, 'taken-slug', 'other-product', 'user-456')

      const service = new ChangeDigitalDownloadableProductSlugService(unitOfWork)

      await expect(service.execute({
        type: 'changeDigitalDownloadableProductSlug',
        id: product.id,
        userId: 'user-123',
        newSlug: 'taken-slug',
        expectedVersion: 0,
      })).rejects.toThrow('already in use')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw on version mismatch', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new ChangeDigitalDownloadableProductSlugService(unitOfWork)

      await expect(service.execute({
        type: 'changeDigitalDownloadableProductSlug',
        id: product.id,
        userId: 'user-123',
        newSlug: 'new-slug',
        expectedVersion: 99,
      })).rejects.toThrow('Optimistic concurrency conflict')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw if product not found', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const service = new ChangeDigitalDownloadableProductSlugService(unitOfWork)

      await expect(service.execute({
        type: 'changeDigitalDownloadableProductSlug',
        id: 'non-existent-id',
        userId: 'user-123',
        newSlug: 'new-slug',
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
