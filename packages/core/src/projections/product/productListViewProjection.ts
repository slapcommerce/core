import type { UnitOfWorkRepositories } from "../../infrastructure/unitOfWork"
import { ProductCreatedEvent } from "../../domain/product/events"
import { ProductArchivedEvent } from "../../domain/product/events"
import { ProductPublishedEvent } from "../../domain/product/events"
import { ProductUnpublishedEvent } from "../../domain/product/events"
import { ProductSlugChangedEvent } from "../../domain/product/events"
import { ProductDetailsUpdatedEvent } from "../../domain/product/events"
import { ProductMetadataUpdatedEvent } from "../../domain/product/events"
import { ProductClassificationUpdatedEvent } from "../../domain/product/events"
import { ProductTagsUpdatedEvent } from "../../domain/product/events"
import { ProductCollectionsUpdatedEvent } from "../../domain/product/events"
import {
  ProductFulfillmentTypeUpdatedEvent,
  ProductVariantOptionsUpdatedEvent,
} from "../../domain/product/events";
import type { ProductEvent } from "../../domain/product/events";
import { CollectionCreatedEvent } from "../../domain/collection/events"
import { CollectionArchivedEvent } from "../../domain/collection/events"
import { CollectionMetadataUpdatedEvent } from "../../domain/collection/events"
import type { CollectionEvent } from "../../domain/collection/events";
import { CollectionAggregate } from "../../domain/collection/aggregate"
import { ProductAggregate } from "../../domain/product/aggregate"
import type { ProductListViewData } from "../../infrastructure/repositories/productListViewRepository"
import type { ProductState } from "../../domain/product/events"
import { assertNever } from "../../lib/assertNever";


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
    meta_title: state.metaTitle,
    meta_description: state.metaDescription,
    taxable: state.taxable ? 1 : 0,
    fulfillment_type: state.fulfillmentType || "digital",
    dropship_safety_buffer: state.dropshipSafetyBuffer ?? null,
    variant_options: state.variantOptions,
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
    meta_title: snapshotData.metaTitle,
    meta_description: snapshotData.metaDescription,
    taxable: snapshotData.taxable ? 1 : 0,
    fulfillment_type: snapshotData.fulfillmentType || "digital",
    dropship_safety_buffer: snapshotData.dropshipSafetyBuffer ?? null,
    variant_options: snapshotData.variantOptions,
  }
}

export class ProductListViewProjection {
  constructor(private repositories: UnitOfWorkRepositories) { }

  private async getCollectionMetadata(
    collectionId: string
  ): Promise<{ id: string; name: string; slug: string; status: string } | null> {
    const { snapshotRepository } = this.repositories;
    const snapshot = snapshotRepository.getSnapshot(collectionId);
    if (!snapshot) {
      return null;
    }
    const collectionAggregate = CollectionAggregate.loadFromSnapshot(snapshot);
    const collectionSnapshot = collectionAggregate.toSnapshot();
    return {
      id: collectionAggregate.id,
      name: collectionSnapshot.name,
      slug: collectionSnapshot.slug,
      status: collectionSnapshot.status,
    };
  }

  async execute(
    event: ProductEvent | CollectionEvent
  ): Promise<void> {
    const { snapshotRepository, productCollectionRepository, productListViewRepository } = this.repositories;
    switch (event.eventName) {
      case "product.created": {
        const productCreatedEvent = event as ProductCreatedEvent;
        const state = productCreatedEvent.payload.newState;

        // Look up collection metadata
        const collections = await Promise.all(
          state.collectionIds.map(id => this.getCollectionMetadata(id))
        );
        const validCollections = collections.filter((c): c is NonNullable<typeof c> => c !== null);

        // Create product list view data
        const productData = createProductListViewData(
          productCreatedEvent.aggregateId,
          productCreatedEvent.correlationId,
          productCreatedEvent.version,
          state,
          productCreatedEvent.occurredAt
        );

        // Save to product_list_view table
        productListViewRepository.save(productData);

        // Delete all existing product-collection relationships for this product
        productCollectionRepository.deleteByProduct(productCreatedEvent.aggregateId);

        // Insert one row per collection with full product data (only for valid collections)
        for (const collectionId of validCollections.map(c => c.id)) {
          productCollectionRepository.save(productData, collectionId);
        }
        break;
      }
      case "product.archived": {
        const productArchivedEvent = event as ProductArchivedEvent;
        const state = productArchivedEvent.payload.newState;

        // Look up collection metadata
        const collections = await Promise.all(
          state.collectionIds.map(id => this.getCollectionMetadata(id))
        );
        const validCollections = collections.filter((c): c is NonNullable<typeof c> => c !== null);

        // Create product list view data
        const productData = createProductListViewData(
          productArchivedEvent.aggregateId,
          productArchivedEvent.correlationId,
          productArchivedEvent.version,
          state,
          productArchivedEvent.occurredAt
        );

        // Save to product_list_view table
        productListViewRepository.save(productData);

        // Delete all existing product-collection relationships for this product
        productCollectionRepository.deleteByProduct(productArchivedEvent.aggregateId);

        // Insert one row per collection with full product data (only for valid collections)
        for (const collectionId of validCollections.map(c => c.id)) {
          productCollectionRepository.save(productData, collectionId);
        }
        break;
      }
      case "product.published": {
        const productPublishedEvent = event as ProductPublishedEvent;
        const state = productPublishedEvent.payload.newState;

        // Look up collection metadata
        const collections = await Promise.all(
          state.collectionIds.map(id => this.getCollectionMetadata(id))
        );
        const validCollections = collections.filter((c): c is NonNullable<typeof c> => c !== null);

        // Create product list view data
        const productData = createProductListViewData(
          productPublishedEvent.aggregateId,
          productPublishedEvent.correlationId,
          productPublishedEvent.version,
          state,
          productPublishedEvent.occurredAt
        );

        // Save to product_list_view table
        productListViewRepository.save(productData);

        // Delete all existing product-collection relationships for this product
        productCollectionRepository.deleteByProduct(productPublishedEvent.aggregateId);

        // Insert one row per collection with full product data (only for valid collections)
        for (const collectionId of validCollections.map(c => c.id)) {
          productCollectionRepository.save(productData, collectionId);
        }
        break;
      }
      case "product.unpublished": {
        const productUnpublishedEvent = event as ProductUnpublishedEvent;
        const state = productUnpublishedEvent.payload.newState;

        // Look up collection metadata
        const collections = await Promise.all(
          state.collectionIds.map(id => this.getCollectionMetadata(id))
        );
        const validCollections = collections.filter((c): c is NonNullable<typeof c> => c !== null);

        // Create product list view data
        const productData = createProductListViewData(
          productUnpublishedEvent.aggregateId,
          productUnpublishedEvent.correlationId,
          productUnpublishedEvent.version,
          state,
          productUnpublishedEvent.occurredAt
        );

        // Save to product_list_view table
        productListViewRepository.save(productData);

        // Delete all existing product-collection relationships for this product
        productCollectionRepository.deleteByProduct(productUnpublishedEvent.aggregateId);

        // Insert one row per collection with full product data (only for valid collections)
        for (const collectionId of validCollections.map(c => c.id)) {
          productCollectionRepository.save(productData, collectionId);
        }
        break;
      }
      case "product.slug_changed": {
        const productSlugChangedEvent = event as ProductSlugChangedEvent;
        const state = productSlugChangedEvent.payload.newState;

        // Look up collection metadata
        const collections = await Promise.all(
          state.collectionIds.map(id => this.getCollectionMetadata(id))
        );
        const validCollections = collections.filter((c): c is NonNullable<typeof c> => c !== null);

        // Create product list view data
        const productData = createProductListViewData(
          productSlugChangedEvent.aggregateId,
          productSlugChangedEvent.correlationId,
          productSlugChangedEvent.version,
          state,
          productSlugChangedEvent.occurredAt
        );

        // Save to product_list_view table
        productListViewRepository.save(productData);

        // Delete all existing product-collection relationships for this product
        productCollectionRepository.deleteByProduct(productSlugChangedEvent.aggregateId);

        // Insert one row per collection with full product data (only for valid collections)
        for (const collectionId of validCollections.map(c => c.id)) {
          productCollectionRepository.save(productData, collectionId);
        }
        break;
      }
      case "product.details_updated": {
        const productDetailsUpdatedEvent = event as ProductDetailsUpdatedEvent;
        const state = productDetailsUpdatedEvent.payload.newState;

        // Look up collection metadata
        const collections = await Promise.all(
          state.collectionIds.map(id => this.getCollectionMetadata(id))
        );
        const validCollections = collections.filter((c): c is NonNullable<typeof c> => c !== null);

        // Create product list view data
        const productData = createProductListViewData(
          productDetailsUpdatedEvent.aggregateId,
          productDetailsUpdatedEvent.correlationId,
          productDetailsUpdatedEvent.version,
          state,
          productDetailsUpdatedEvent.occurredAt
        );

        // Save to product_list_view table
        productListViewRepository.save(productData);

        // Delete all existing product-collection relationships for this product
        productCollectionRepository.deleteByProduct(productDetailsUpdatedEvent.aggregateId);

        // Insert one row per collection with full product data (only for valid collections)
        for (const collectionId of validCollections.map(c => c.id)) {
          productCollectionRepository.save(productData, collectionId);
        }
        break;
      }
      case "product.metadata_updated": {
        const productMetadataUpdatedEvent = event as ProductMetadataUpdatedEvent;
        const state = productMetadataUpdatedEvent.payload.newState;

        // Look up collection metadata
        const collections = await Promise.all(
          state.collectionIds.map(id => this.getCollectionMetadata(id))
        );
        const validCollections = collections.filter((c): c is NonNullable<typeof c> => c !== null);

        // Create product list view data
        const productData = createProductListViewData(
          productMetadataUpdatedEvent.aggregateId,
          productMetadataUpdatedEvent.correlationId,
          productMetadataUpdatedEvent.version,
          state,
          productMetadataUpdatedEvent.occurredAt
        );

        // Save to product_list_view table
        productListViewRepository.save(productData);

        // Delete all existing product-collection relationships for this product
        productCollectionRepository.deleteByProduct(productMetadataUpdatedEvent.aggregateId);

        // Insert one row per collection with full product data (only for valid collections)
        for (const collectionId of validCollections.map(c => c.id)) {
          productCollectionRepository.save(productData, collectionId);
        }
        break;
      }
      case "product.classification_updated": {
        const productClassificationUpdatedEvent = event as ProductClassificationUpdatedEvent;
        const state = productClassificationUpdatedEvent.payload.newState;

        // Look up collection metadata
        const collections = await Promise.all(
          state.collectionIds.map(id => this.getCollectionMetadata(id))
        );
        const validCollections = collections.filter((c): c is NonNullable<typeof c> => c !== null);

        // Create product list view data
        const productData = createProductListViewData(
          productClassificationUpdatedEvent.aggregateId,
          productClassificationUpdatedEvent.correlationId,
          productClassificationUpdatedEvent.version,
          state,
          productClassificationUpdatedEvent.occurredAt
        );

        // Save to product_list_view table
        productListViewRepository.save(productData);

        // Delete all existing product-collection relationships for this product
        productCollectionRepository.deleteByProduct(productClassificationUpdatedEvent.aggregateId);

        // Insert one row per collection with full product data (only for valid collections)
        for (const collectionId of validCollections.map(c => c.id)) {
          productCollectionRepository.save(productData, collectionId);
        }
        break;
      }
      case "product.tags_updated": {
        const productTagsUpdatedEvent = event as ProductTagsUpdatedEvent;
        const state = productTagsUpdatedEvent.payload.newState;

        // Look up collection metadata
        const collections = await Promise.all(
          state.collectionIds.map(id => this.getCollectionMetadata(id))
        );
        const validCollections = collections.filter((c): c is NonNullable<typeof c> => c !== null);

        // Create product list view data
        const productData = createProductListViewData(
          productTagsUpdatedEvent.aggregateId,
          productTagsUpdatedEvent.correlationId,
          productTagsUpdatedEvent.version,
          state,
          productTagsUpdatedEvent.occurredAt
        );

        // Save to product_list_view table
        productListViewRepository.save(productData);

        // Delete all existing product-collection relationships for this product
        productCollectionRepository.deleteByProduct(productTagsUpdatedEvent.aggregateId);

        // Insert one row per collection with full product data (only for valid collections)
        for (const collectionId of validCollections.map(c => c.id)) {
          productCollectionRepository.save(productData, collectionId);
        }
        break;
      }
      case "product.collections_updated": {
        const productCollectionsUpdatedEvent = event as ProductCollectionsUpdatedEvent;
        const state = productCollectionsUpdatedEvent.payload.newState;

        // Look up collection metadata
        const collections = await Promise.all(
          state.collectionIds.map(id => this.getCollectionMetadata(id))
        );
        const validCollections = collections.filter((c): c is NonNullable<typeof c> => c !== null);

        // Create product list view data
        const productData = createProductListViewData(
          productCollectionsUpdatedEvent.aggregateId,
          productCollectionsUpdatedEvent.correlationId,
          productCollectionsUpdatedEvent.version,
          state,
          productCollectionsUpdatedEvent.occurredAt
        );

        // Save to product_list_view table
        productListViewRepository.save(productData);

        // Delete all existing product-collection relationships for this product
        productCollectionRepository.deleteByProduct(productCollectionsUpdatedEvent.aggregateId);

        // Insert one row per collection with full product data (only for valid collections)
        for (const collectionId of validCollections.map(c => c.id)) {
          productCollectionRepository.save(productData, collectionId);
        }
        break;
      }
      case "product.variant_options_updated": {
        const productVariantOptionsUpdatedEvent = event as ProductVariantOptionsUpdatedEvent;
        const state = productVariantOptionsUpdatedEvent.payload.newState;

        // Look up collection metadata
        const collections = await Promise.all(
          state.collectionIds.map(id => this.getCollectionMetadata(id))
        );
        const validCollections = collections.filter((c): c is NonNullable<typeof c> => c !== null);

        // Create product list view data
        const productData = createProductListViewData(
          productVariantOptionsUpdatedEvent.aggregateId,
          productVariantOptionsUpdatedEvent.correlationId,
          productVariantOptionsUpdatedEvent.version,
          state,
          productVariantOptionsUpdatedEvent.occurredAt
        );

        // Save to product_list_view table
        productListViewRepository.save(productData);

        // Delete all existing product-collection relationships for this product
        productCollectionRepository.deleteByProduct(productVariantOptionsUpdatedEvent.aggregateId);

        // Insert one row per collection with full product data (only for valid collections)
        for (const collectionId of validCollections.map(c => c.id)) {
          productCollectionRepository.save(productData, collectionId);
        }
        break;
      }
      case "product.fulfillment_type_updated": {
        const productFulfillmentTypeUpdatedEvent = event as ProductFulfillmentTypeUpdatedEvent;
        const state = productFulfillmentTypeUpdatedEvent.payload.newState;

        // Look up collection metadata
        const collections = await Promise.all(
          state.collectionIds.map(id => this.getCollectionMetadata(id))
        );
        const validCollections = collections.filter((c): c is NonNullable<typeof c> => c !== null);

        // Create product list view data
        const productData = createProductListViewData(
          productFulfillmentTypeUpdatedEvent.aggregateId,
          productFulfillmentTypeUpdatedEvent.correlationId,
          productFulfillmentTypeUpdatedEvent.version,
          state,
          productFulfillmentTypeUpdatedEvent.occurredAt
        );

        // Save to product_list_view table
        productListViewRepository.save(productData);

        // Delete all existing product-collection relationships for this product
        productCollectionRepository.deleteByProduct(productFulfillmentTypeUpdatedEvent.aggregateId);

        // Insert one row per collection with full product data (only for valid collections)
        for (const collectionId of validCollections.map(c => c.id)) {
          productCollectionRepository.save(productData, collectionId);
        }
        break;
      }
      case "collection.created":
      case "collection.archived":
      case "collection.metadata_updated":
      case "collection.published":
      case "collection.seo_metadata_updated":
      case "collection.unpublished":
      case "collection.images_updated": {
        // When a collection is created/updated/archived, update all product projections that reference it
        const collectionEvent = event as CollectionEvent;
        const collectionId = collectionEvent.aggregateId;

        // Get updated collection metadata
        const collectionMetadata = await this.getCollectionMetadata(collectionId);
        if (!collectionMetadata) {
          break;
        }

        // Find products already in product_collections table
        const productsInCollection = productCollectionRepository.findByCollection(collectionId);

        // Update existing product_collections table rows (refresh product data if needed)
        for (const productData of productsInCollection) {
          // Re-save the product data for this collection (in case product data changed)
          productCollectionRepository.save(productData, collectionId);
        }

        // Retroactively find products that reference this collection via product_list_view
        // This handles the race condition where products were created before the collection existed
        // Use efficient JSON query instead of scanning all snapshots
        const productsWithCollection = productListViewRepository.findByCollectionId(collectionId);

        for (const productData of productsWithCollection) {
          // Create/update the product-collection relationship
          // This is idempotent - if the relationship already exists, it will be updated
          productCollectionRepository.save(productData, collectionId);
        }
        break;
      }
      default:
        assertNever(event);
    }
  }
}
