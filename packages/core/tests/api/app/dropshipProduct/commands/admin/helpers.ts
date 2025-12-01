import { createTestDatabase, closeTestDatabase } from '../../../../../helpers/database'
import { TransactionBatcher } from '../../../../../../src/api/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../../../../src/api/infrastructure/unitOfWork'
import { CreateDropshipProductService } from '../../../../../../src/api/app/dropshipProduct/commands/admin/createDropshipProductService'
import type { CreateDropshipProductCommand } from '../../../../../../src/api/app/dropshipProduct/commands/admin/commands'

export async function setupTestEnvironment() {
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

export function createValidProductCommand(overrides?: Partial<CreateDropshipProductCommand>): CreateDropshipProductCommand {
  return {
    type: 'createDropshipProduct',
    id: 'product-123',
    correlationId: 'correlation-123',
    userId: 'user-123',
    name: 'Test Dropship Product',
    description: 'A test dropship product',
    slug: 'test-dropship-product',
    collections: ['collection-1'],
    richDescriptionUrl: 'https://example.com/description',
    vendor: 'Test Vendor',
    variantOptions: [{ name: 'Size', values: ['S', 'M', 'L'] }],
    metaTitle: 'Test Product Meta',
    metaDescription: 'Test product description',
    tags: ['tag1', 'tag2'],
    taxable: true,
    taxId: 'TAX123',
    dropshipSafetyBuffer: 5,
    fulfillmentProviderId: null,
    supplierCost: null,
    supplierSku: null,
    ...overrides,
  }
}

export async function createTestProduct(unitOfWork: UnitOfWork, overrides?: Partial<CreateDropshipProductCommand>) {
  const service = new CreateDropshipProductService(unitOfWork)
  const command = createValidProductCommand(overrides)
  await service.execute(command)
  return command
}
