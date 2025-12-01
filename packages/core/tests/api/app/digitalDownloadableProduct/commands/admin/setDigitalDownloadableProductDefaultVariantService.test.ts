import { describe, test, expect } from 'bun:test'
import { closeTestDatabase } from '../../../../../helpers/database'
import { SetDigitalDownloadableProductDefaultVariantService } from '../../../../../../src/api/app/digitalDownloadableProduct/commands/admin/setDigitalDownloadableProductDefaultVariantService'
import { VariantPositionsWithinProductAggregate } from '../../../../../../src/api/domain/variantPositionsWithinProduct/aggregate'
import { setupTestEnvironment, createTestProduct } from './helpers'
import { UnitOfWork } from '../../../../../../src/api/infrastructure/unitOfWork'

async function addVariantToPositions(unitOfWork: UnitOfWork, positionsAggregateId: string, variantId: string, userId: string) {
  await unitOfWork.withTransaction(async ({ snapshotRepository, eventRepository, outboxRepository }) => {
    const positionsSnapshot = snapshotRepository.getSnapshot(positionsAggregateId)
    if (!positionsSnapshot) throw new Error('Positions aggregate not found')

    const positionsAggregate = VariantPositionsWithinProductAggregate.loadFromSnapshot(positionsSnapshot)
    positionsAggregate.addVariant(variantId, userId)

    for (const event of positionsAggregate.uncommittedEvents) {
      eventRepository.addEvent(event)
      outboxRepository.addOutboxEvent(event, { id: crypto.randomUUID() })
    }

    snapshotRepository.saveSnapshot({
      aggregateId: positionsAggregateId,
      correlationId: 'test-correlation',
      version: positionsAggregate.version,
      payload: positionsAggregate.toSnapshot(),
    })
  })
}

describe('SetDigitalDownloadableProductDefaultVariantService', () => {
  test('should set default variant when variant belongs to product', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)

      // Get the variant positions aggregate ID from the product snapshot
      const productSnapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(product.id) as any
      const productPayload = JSON.parse(productSnapshot.payload)
      const positionsAggregateId = productPayload.variantPositionsAggregateId

      // Add a variant to the positions
      await addVariantToPositions(unitOfWork, positionsAggregateId, 'variant-123', 'user-123')

      const service = new SetDigitalDownloadableProductDefaultVariantService(unitOfWork)

      await service.execute({
        type: 'setDigitalDownloadableProductDefaultVariant',
        productId: product.id,
        variantId: 'variant-123',
        userId: 'user-123',
        expectedVersion: 0,
      })

      const updatedSnapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(product.id) as any
      const updatedPayload = JSON.parse(updatedSnapshot.payload)
      expect(updatedPayload.defaultVariantId).toBe('variant-123')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw if variant does not belong to product', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)
      const service = new SetDigitalDownloadableProductDefaultVariantService(unitOfWork)

      await expect(service.execute({
        type: 'setDigitalDownloadableProductDefaultVariant',
        productId: product.id,
        variantId: 'non-existent-variant',
        userId: 'user-123',
        expectedVersion: 0,
      })).rejects.toThrow('does not belong to product')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })

  test('should throw on version mismatch', async () => {
    const { db, batcher, unitOfWork } = await setupTestEnvironment()

    try {
      const product = await createTestProduct(unitOfWork)

      // Get the variant positions aggregate ID from the product snapshot
      const productSnapshot = db.query(`SELECT payload FROM snapshots WHERE aggregateId = ?`).get(product.id) as any
      const productPayload = JSON.parse(productSnapshot.payload)
      const positionsAggregateId = productPayload.variantPositionsAggregateId

      // Add a variant to the positions
      await addVariantToPositions(unitOfWork, positionsAggregateId, 'variant-123', 'user-123')

      const service = new SetDigitalDownloadableProductDefaultVariantService(unitOfWork)

      await expect(service.execute({
        type: 'setDigitalDownloadableProductDefaultVariant',
        productId: product.id,
        variantId: 'variant-123',
        userId: 'user-123',
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
      const service = new SetDigitalDownloadableProductDefaultVariantService(unitOfWork)

      await expect(service.execute({
        type: 'setDigitalDownloadableProductDefaultVariant',
        productId: 'non-existent-id',
        variantId: 'variant-123',
        userId: 'user-123',
        expectedVersion: 0,
      })).rejects.toThrow('not found')
    } finally {
      batcher.stop()
      closeTestDatabase(db)
    }
  })
})
