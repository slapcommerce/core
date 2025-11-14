import type { DomainEvent } from "../../domain/_base/domainEvent"
import type { ProjectionHandler, UnitOfWorkRepositories } from "../../infrastructure/projectionService"
import { ProductCreatedEvent } from "../../domain/product/events"
import { ProductArchivedEvent } from "../../domain/product/events"
import { ProductPublishedEvent } from "../../domain/product/events"
import { ProductDetailsUpdatedEvent } from "../../domain/product/events"
import { ProductMetadataUpdatedEvent } from "../../domain/product/events"
import { ProductClassificationUpdatedEvent } from "../../domain/product/events"
import { ProductTagsUpdatedEvent } from "../../domain/product/events"
import { ProductShippingSettingsUpdatedEvent } from "../../domain/product/events"
import { ProductPageLayoutUpdatedEvent } from "../../domain/product/events"
import { CollectionCreatedEvent } from "../../domain/collection/events"
import { CollectionArchivedEvent } from "../../domain/collection/events"
import { CollectionMetadataUpdatedEvent } from "../../domain/collection/events"
import { CollectionAggregate } from "../../domain/collection/aggregate"
import { ProductAggregate } from "../../domain/product/aggregate"
import type { ProductListViewData } from "../../infrastructure/repositories/productListViewRepository"
import type { ProductState } from "../../domain/product/events"

async function getCollectionMetadata(
  collectionId: string,
  repositories: UnitOfWorkRepositories
): Promise<{ id: string; name: string; slug: string; status: string } | null> {
  const { snapshotRepository } = repositories
  const snapshot = snapshotRepository.getSnapshot(collectionId)
  if (!snapshot) {
    return null
  }
  const collectionAggregate = CollectionAggregate.loadFromSnapshot(snapshot)
  const collectionSnapshot = collectionAggregate.toSnapshot()
  return {
    id: collectionAggregate.id,
    name: collectionSnapshot.name,
    slug: collectionSnapshot.slug,
    status: collectionSnapshot.status,
  }
}

function createProductListViewData(
  aggregateId: string,
  correlationId: string,
  version: number,
  state: ProductState,
  updatedAt: Date
): ProductListViewData {
  return {
    aggregate_id: aggregateId,
    title: state.title,
    slug: state.slug,
    vendor: state.vendor,
    product_type: state.productType,
    short_description: state.shortDescription,
    tags: state.tags,
    created_at: state.createdAt,
    status: state.status,
    correlation_id: correlationId,
    version: version,
    updated_at: updatedAt,
    collection_ids: state.collectionIds,
  }
}

function createProductListViewDataFromSnapshot(
  snapshot: {
    aggregate_id: string
    correlation_id: string
    version: number
    payload: string
  }
): ProductListViewData {
  const productAggregate = ProductAggregate.loadFromSnapshot(snapshot)
  const snapshotData = productAggregate.toSnapshot()
  
  return {
    aggregate_id: snapshot.aggregate_id,
    title: snapshotData.title,
    slug: snapshotData.slug,
    vendor: snapshotData.vendor,
    product_type: snapshotData.productType,
    short_description: snapshotData.shortDescription,
    tags: snapshotData.tags,
    created_at: snapshotData.createdAt,
    status: snapshotData.status,
    correlation_id: snapshot.correlation_id,
    version: snapshot.version,
    updated_at: snapshotData.updatedAt,
    collection_ids: snapshotData.collectionIds,
  }
}

export const productListViewProjection: ProjectionHandler = async (
  event: DomainEvent<string, Record<string, unknown>>,
  repositories: UnitOfWorkRepositories
): Promise<void> => {
  const { snapshotRepository, productCollectionRepository, productListViewRepository } = repositories
  switch (event.eventName) {
    case "product.created": {
      const productCreatedEvent = event as ProductCreatedEvent
      const state = productCreatedEvent.payload.newState

      // Look up collection metadata
      const collections = await Promise.all(
        state.collectionIds.map(id => getCollectionMetadata(id, repositories))
      )
      const validCollections = collections.filter((c): c is NonNullable<typeof c> => c !== null)

      // Create product list view data
      const productData = createProductListViewData(
        productCreatedEvent.aggregateId,
        productCreatedEvent.correlationId,
        productCreatedEvent.version,
        state,
        productCreatedEvent.occurredAt
      )

      // Save to product_list_view table
      productListViewRepository.save(productData)

      // Delete all existing product-collection relationships for this product
      productCollectionRepository.deleteByProduct(productCreatedEvent.aggregateId)

      // Insert one row per collection with full product data (only for valid collections)
      for (const collectionId of validCollections.map(c => c.id)) {
        productCollectionRepository.save(productData, collectionId)
      }
      break
    }
    case "product.archived": {
      const productArchivedEvent = event as ProductArchivedEvent
      const state = productArchivedEvent.payload.newState

      // Look up collection metadata
      const collections = await Promise.all(
        state.collectionIds.map(id => getCollectionMetadata(id, repositories))
      )
      const validCollections = collections.filter((c): c is NonNullable<typeof c> => c !== null)

      // Create product list view data
      const productData = createProductListViewData(
        productArchivedEvent.aggregateId,
        productArchivedEvent.correlationId,
        productArchivedEvent.version,
        state,
        productArchivedEvent.occurredAt
      )

      // Save to product_list_view table
      productListViewRepository.save(productData)

      // Delete all existing product-collection relationships for this product
      productCollectionRepository.deleteByProduct(productArchivedEvent.aggregateId)

      // Insert one row per collection with full product data (only for valid collections)
      for (const collectionId of validCollections.map(c => c.id)) {
        productCollectionRepository.save(productData, collectionId)
      }
      break
    }
    case "product.published": {
      const productPublishedEvent = event as ProductPublishedEvent
      const state = productPublishedEvent.payload.newState

      // Look up collection metadata
      const collections = await Promise.all(
        state.collectionIds.map(id => getCollectionMetadata(id, repositories))
      )
      const validCollections = collections.filter((c): c is NonNullable<typeof c> => c !== null)

      // Create product list view data
      const productData = createProductListViewData(
        productPublishedEvent.aggregateId,
        productPublishedEvent.correlationId,
        productPublishedEvent.version,
        state,
        productPublishedEvent.occurredAt
      )

      // Save to product_list_view table
      productListViewRepository.save(productData)

      // Delete all existing product-collection relationships for this product
      productCollectionRepository.deleteByProduct(productPublishedEvent.aggregateId)

      // Insert one row per collection with full product data (only for valid collections)
      for (const collectionId of validCollections.map(c => c.id)) {
        productCollectionRepository.save(productData, collectionId)
      }
      break
    }
    case "product.details_updated": {
      const productDetailsUpdatedEvent = event as ProductDetailsUpdatedEvent
      const state = productDetailsUpdatedEvent.payload.newState

      // Look up collection metadata
      const collections = await Promise.all(
        state.collectionIds.map(id => getCollectionMetadata(id, repositories))
      )
      const validCollections = collections.filter((c): c is NonNullable<typeof c> => c !== null)

      // Create product list view data
      const productData = createProductListViewData(
        productDetailsUpdatedEvent.aggregateId,
        productDetailsUpdatedEvent.correlationId,
        productDetailsUpdatedEvent.version,
        state,
        productDetailsUpdatedEvent.occurredAt
      )

      // Save to product_list_view table
      productListViewRepository.save(productData)

      // Delete all existing product-collection relationships for this product
      productCollectionRepository.deleteByProduct(productDetailsUpdatedEvent.aggregateId)

      // Insert one row per collection with full product data (only for valid collections)
      for (const collectionId of validCollections.map(c => c.id)) {
        productCollectionRepository.save(productData, collectionId)
      }
      break
    }
    case "product.metadata_updated": {
      const productMetadataUpdatedEvent = event as ProductMetadataUpdatedEvent
      const state = productMetadataUpdatedEvent.payload.newState

      // Look up collection metadata
      const collections = await Promise.all(
        state.collectionIds.map(id => getCollectionMetadata(id, repositories))
      )
      const validCollections = collections.filter((c): c is NonNullable<typeof c> => c !== null)

      // Create product list view data
      const productData = createProductListViewData(
        productMetadataUpdatedEvent.aggregateId,
        productMetadataUpdatedEvent.correlationId,
        productMetadataUpdatedEvent.version,
        state,
        productMetadataUpdatedEvent.occurredAt
      )

      // Save to product_list_view table
      productListViewRepository.save(productData)

      // Delete all existing product-collection relationships for this product
      productCollectionRepository.deleteByProduct(productMetadataUpdatedEvent.aggregateId)

      // Insert one row per collection with full product data (only for valid collections)
      for (const collectionId of validCollections.map(c => c.id)) {
        productCollectionRepository.save(productData, collectionId)
      }
      break
    }
    case "product.classification_updated": {
      const productClassificationUpdatedEvent = event as ProductClassificationUpdatedEvent
      const state = productClassificationUpdatedEvent.payload.newState

      // Look up collection metadata
      const collections = await Promise.all(
        state.collectionIds.map(id => getCollectionMetadata(id, repositories))
      )
      const validCollections = collections.filter((c): c is NonNullable<typeof c> => c !== null)

      // Create product list view data
      const productData = createProductListViewData(
        productClassificationUpdatedEvent.aggregateId,
        productClassificationUpdatedEvent.correlationId,
        productClassificationUpdatedEvent.version,
        state,
        productClassificationUpdatedEvent.occurredAt
      )

      // Save to product_list_view table
      productListViewRepository.save(productData)

      // Delete all existing product-collection relationships for this product
      productCollectionRepository.deleteByProduct(productClassificationUpdatedEvent.aggregateId)

      // Insert one row per collection with full product data (only for valid collections)
      for (const collectionId of validCollections.map(c => c.id)) {
        productCollectionRepository.save(productData, collectionId)
      }
      break
    }
    case "product.tags_updated": {
      const productTagsUpdatedEvent = event as ProductTagsUpdatedEvent
      const state = productTagsUpdatedEvent.payload.newState

      // Look up collection metadata
      const collections = await Promise.all(
        state.collectionIds.map(id => getCollectionMetadata(id, repositories))
      )
      const validCollections = collections.filter((c): c is NonNullable<typeof c> => c !== null)

      // Create product list view data
      const productData = createProductListViewData(
        productTagsUpdatedEvent.aggregateId,
        productTagsUpdatedEvent.correlationId,
        productTagsUpdatedEvent.version,
        state,
        productTagsUpdatedEvent.occurredAt
      )

      // Save to product_list_view table
      productListViewRepository.save(productData)

      // Delete all existing product-collection relationships for this product
      productCollectionRepository.deleteByProduct(productTagsUpdatedEvent.aggregateId)

      // Insert one row per collection with full product data (only for valid collections)
      for (const collectionId of validCollections.map(c => c.id)) {
        productCollectionRepository.save(productData, collectionId)
      }
      break
    }
    case "product.shipping_settings_updated": {
      const productShippingSettingsUpdatedEvent = event as ProductShippingSettingsUpdatedEvent
      const state = productShippingSettingsUpdatedEvent.payload.newState

      // Look up collection metadata
      const collections = await Promise.all(
        state.collectionIds.map(id => getCollectionMetadata(id, repositories))
      )
      const validCollections = collections.filter((c): c is NonNullable<typeof c> => c !== null)

      // Create product list view data
      const productData = createProductListViewData(
        productShippingSettingsUpdatedEvent.aggregateId,
        productShippingSettingsUpdatedEvent.correlationId,
        productShippingSettingsUpdatedEvent.version,
        state,
        productShippingSettingsUpdatedEvent.occurredAt
      )

      // Save to product_list_view table
      productListViewRepository.save(productData)

      // Delete all existing product-collection relationships for this product
      productCollectionRepository.deleteByProduct(productShippingSettingsUpdatedEvent.aggregateId)

      // Insert one row per collection with full product data (only for valid collections)
      for (const collectionId of validCollections.map(c => c.id)) {
        productCollectionRepository.save(productData, collectionId)
      }
      break
    }
    case "product.page_layout_updated": {
      const productPageLayoutUpdatedEvent = event as ProductPageLayoutUpdatedEvent
      const state = productPageLayoutUpdatedEvent.payload.newState

      // Look up collection metadata
      const collections = await Promise.all(
        state.collectionIds.map(id => getCollectionMetadata(id, repositories))
      )
      const validCollections = collections.filter((c): c is NonNullable<typeof c> => c !== null)

      // Create product list view data
      const productData = createProductListViewData(
        productPageLayoutUpdatedEvent.aggregateId,
        productPageLayoutUpdatedEvent.correlationId,
        productPageLayoutUpdatedEvent.version,
        state,
        productPageLayoutUpdatedEvent.occurredAt
      )

      // Save to product_list_view table
      productListViewRepository.save(productData)

      // Delete all existing product-collection relationships for this product
      productCollectionRepository.deleteByProduct(productPageLayoutUpdatedEvent.aggregateId)

      // Insert one row per collection with full product data (only for valid collections)
      for (const collectionId of validCollections.map(c => c.id)) {
        productCollectionRepository.save(productData, collectionId)
      }
      break
    }
    case "collection.created":
    case "collection.archived":
    case "collection.metadata_updated": {
      // When a collection is created/updated/archived, update all product projections that reference it
      const collectionEvent = event as CollectionCreatedEvent | CollectionArchivedEvent | CollectionMetadataUpdatedEvent
      const collectionId = collectionEvent.aggregateId

      // Get updated collection metadata
      const collectionMetadata = await getCollectionMetadata(collectionId, repositories)
      if (!collectionMetadata) {
        break
      }

      // Find products already in product_collections table
      const productsInCollection = productCollectionRepository.findByCollection(collectionId)

      // Update existing product_collections table rows (refresh product data if needed)
      for (const productData of productsInCollection) {
        // Re-save the product data for this collection (in case product data changed)
        productCollectionRepository.save(productData, collectionId)
      }

      // Retroactively find products that reference this collection via product_list_view
      // This handles the race condition where products were created before the collection existed
      // Use efficient JSON query instead of scanning all snapshots
      const productsWithCollection = productListViewRepository.findByCollectionId(collectionId)
      
      for (const productData of productsWithCollection) {
        // Create/update the product-collection relationship
        // This is idempotent - if the relationship already exists, it will be updated
        productCollectionRepository.save(productData, collectionId)
      }
      break
    }
  }
}

