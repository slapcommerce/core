import type { ProductListViewData } from "../../infrastructure/repositories/productListViewRepository"
import type { ProductEvent, ProductState } from "../../domain/product/events";
import type { CollectionEvent } from "../../domain/collection/events";
import { ProductAggregate } from "../../domain/product/aggregate";
import { CollectionAggregate } from "../../domain/collection/aggregate";
import { Projection } from "../_base/projection";


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

export class ProductListViewProjection extends Projection<ProductEvent | CollectionEvent> {
  protected handlers = {
    'product.created': this.handleProductEvent.bind(this),
    'product.archived': this.handleProductEvent.bind(this),
    'product.published': this.handleProductEvent.bind(this),
    'product.unpublished': this.handleProductEvent.bind(this),
    'product.slug_changed': this.handleProductEvent.bind(this),
    'product.details_updated': this.handleProductEvent.bind(this),
    'product.metadata_updated': this.handleProductEvent.bind(this),
    'product.classification_updated': this.handleProductEvent.bind(this),
    'product.tags_updated': this.handleProductEvent.bind(this),
    'product.collections_updated': this.handleProductEvent.bind(this),
    'product.variant_options_updated': this.handleProductEvent.bind(this),
    'product.fulfillment_type_updated': this.handleProductEvent.bind(this),
    'product.update_product_tax_details': this.handleProductEvent.bind(this),
    'collection.created': this.handleCollectionEvent.bind(this),
    'collection.archived': this.handleCollectionEvent.bind(this),
    'collection.metadata_updated': this.handleCollectionEvent.bind(this),
    'collection.published': this.handleCollectionEvent.bind(this),
    'collection.seo_metadata_updated': this.handleCollectionEvent.bind(this),
    'collection.unpublished': this.handleCollectionEvent.bind(this),
    'collection.images_updated': this.handleCollectionEvent.bind(this),
  };

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

  private async handleProductEvent(event: ProductEvent): Promise<void> {
    const { productCollectionRepository, productListViewRepository } = this.repositories;
    const state = event.payload.newState;

    // Look up collection metadata
    const collections = await Promise.all(
      state.collectionIds.map(id => this.getCollectionMetadata(id))
    );
    const validCollections = collections.filter((c): c is NonNullable<typeof c> => c !== null);

    // Create product list view data
    const productData = createProductListViewData(
      event.aggregateId,
      event.correlationId,
      event.version,
      state,
      event.occurredAt
    );

    // Save to product_list_view table
    productListViewRepository.save(productData);

    // Delete all existing product-collection relationships for this product
    productCollectionRepository.deleteByProduct(event.aggregateId);

    // Insert one row per collection with full product data (only for valid collections)
    for (const collectionId of validCollections.map(c => c.id)) {
      productCollectionRepository.save(productData, collectionId);
    }
  }

  private async handleCollectionEvent(event: CollectionEvent): Promise<void> {
    const { productCollectionRepository, productListViewRepository } = this.repositories;
    const collectionId = event.aggregateId;

    // Get updated collection metadata
    const collectionMetadata = await this.getCollectionMetadata(collectionId);
    if (!collectionMetadata) {
      return;
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
  }
}
