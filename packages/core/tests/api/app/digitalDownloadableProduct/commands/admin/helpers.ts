import { createTestDatabase, closeTestDatabase } from '../../../../../helpers/database'
import { TransactionBatcher } from '../../../../../../src/api/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../../../../src/api/infrastructure/unitOfWork'
import { CreateDigitalDownloadableProductService } from '../../../../../../src/api/app/digitalDownloadableProduct/commands/admin/createDigitalDownloadableProductService'
import { CreateDigitalDownloadableVariantService } from '../../../../../../src/api/app/digitalDownloadableVariant/commands/admin/createDigitalDownloadableVariantService'
import type { CreateDigitalDownloadableProductCommand } from '../../../../../../src/api/app/digitalDownloadableProduct/commands/admin/commands'
import type { CreateDigitalDownloadableVariantCommand } from '../../../../../../src/api/app/digitalDownloadableVariant/commands/admin/commands'

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

export function createValidProductCommand(overrides?: Partial<CreateDigitalDownloadableProductCommand>): CreateDigitalDownloadableProductCommand {
  return {
    type: 'createDigitalDownloadableProduct',
    id: 'product-123',
    correlationId: 'correlation-123',
    userId: 'user-123',
    name: 'Test Digital Product',
    description: 'A test digital product',
    slug: 'test-digital-product',
    collections: ['collection-1'],
    richDescriptionUrl: 'https://example.com/description',
    vendor: 'Test Vendor',
    variantOptions: [{ name: 'Size', values: ['S', 'M', 'L'] }],
    metaTitle: 'Test Product Meta',
    metaDescription: 'Test product description',
    tags: ['tag1', 'tag2'],
    taxable: true,
    taxId: 'TAX123',
    maxDownloads: 5,
    accessDurationDays: 30,
    ...overrides,
  }
}

export async function createTestProduct(unitOfWork: UnitOfWork, overrides?: Partial<CreateDigitalDownloadableProductCommand>) {
  const service = new CreateDigitalDownloadableProductService(unitOfWork)
  const command = createValidProductCommand(overrides)
  await service.execute(command)
  return command
}

export function createValidVariantCommand(overrides?: Partial<CreateDigitalDownloadableVariantCommand>): CreateDigitalDownloadableVariantCommand {
  return {
    type: 'createDigitalDownloadableVariant',
    id: 'variant-123',
    correlationId: 'correlation-123',
    userId: 'user-123',
    productId: 'product-123',
    sku: 'TEST-SKU-001',
    price: 1999,
    options: { Size: 'M' },
    maxDownloads: 5,
    accessDurationDays: 30,
    ...overrides,
  }
}

export async function createTestVariant(unitOfWork: UnitOfWork, overrides?: Partial<CreateDigitalDownloadableVariantCommand>) {
  const service = new CreateDigitalDownloadableVariantService(unitOfWork)
  const command = createValidVariantCommand(overrides)
  await service.execute(command)
  return command
}
