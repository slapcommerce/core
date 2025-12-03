import { createTestDatabase, closeTestDatabase } from '../../../../../helpers/database'
import { TransactionBatcher } from '../../../../../../src/api/infrastructure/transactionBatcher'
import { UnitOfWork } from '../../../../../../src/api/infrastructure/unitOfWork'
import { CreateDropshipProductService } from '../../../../../../src/api/app/dropshipProduct/commands/admin/createDropshipProductService'
import { CreateDropshipVariantService } from '../../../../../../src/api/app/dropshipVariant/commands/admin/createDropshipVariantService'
import type { CreateDropshipProductCommand } from '../../../../../../src/api/app/dropshipProduct/commands/admin/commands'
import type { CreateDropshipVariantCommand } from '../../../../../../src/api/app/dropshipVariant/commands/admin/commands'
import type { ImageUploadResult } from '../../../../../../src/api/infrastructure/adapters/imageStorageAdapter'
import type { ImageUploadHelper } from '../../../../../../src/api/infrastructure/imageUploadHelper'

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

export function createValidVariantCommand(overrides?: Partial<CreateDropshipVariantCommand>): CreateDropshipVariantCommand {
  return {
    type: 'createDropshipVariant',
    id: 'variant-123',
    correlationId: 'correlation-123',
    userId: 'user-123',
    productId: 'product-123',
    sku: 'TEST-SKU-001',
    price: 1999,
    inventory: 10,
    options: { Size: 'M' },
    fulfillmentProviderId: 'provider-123',
    supplierCost: 1000,
    supplierSku: 'SUPPLIER-SKU-001',
    ...overrides,
  }
}

export async function createTestProduct(unitOfWork: UnitOfWork, overrides?: Partial<CreateDropshipProductCommand>) {
  const service = new CreateDropshipProductService(unitOfWork)
  const command = createValidProductCommand(overrides)
  await service.execute(command)
  return command
}

export async function createTestVariant(unitOfWork: UnitOfWork, overrides?: Partial<CreateDropshipVariantCommand>) {
  const service = new CreateDropshipVariantService(unitOfWork)
  const command = createValidVariantCommand(overrides)
  await service.execute(command)
  return command
}

export class MockImageUploadHelper implements Pick<ImageUploadHelper, 'uploadImage'> {
  async uploadImage(
    buffer: ArrayBuffer,
    filename: string,
    contentType: string
  ): Promise<ImageUploadResult> {
    return {
      imageId: 'test-image-id',
      urls: {
        thumbnail: {
          original: 'https://example.com/images/test-image-id-thumb.png',
          webp: 'https://example.com/images/test-image-id-thumb.webp',
          avif: 'https://example.com/images/test-image-id-thumb.avif',
        },
        small: {
          original: 'https://example.com/images/test-image-id-small.png',
          webp: 'https://example.com/images/test-image-id-small.webp',
          avif: 'https://example.com/images/test-image-id-small.avif',
        },
        medium: {
          original: 'https://example.com/images/test-image-id-medium.png',
          webp: 'https://example.com/images/test-image-id-medium.webp',
          avif: 'https://example.com/images/test-image-id-medium.avif',
        },
        large: {
          original: 'https://example.com/images/test-image-id-large.png',
          webp: 'https://example.com/images/test-image-id-large.webp',
          avif: 'https://example.com/images/test-image-id-large.avif',
        },
        original: {
          original: 'https://example.com/images/test-image-id.png',
          webp: 'https://example.com/images/test-image-id.webp',
          avif: 'https://example.com/images/test-image-id.avif',
        },
      },
    }
  }
}
