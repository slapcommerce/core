import type { DomainEvent } from "../../domain/_base/domainEvent"
import type { UnitOfWorkRepositories } from "../../infrastructure/unitOfWork"
import type { ProductListViewData } from "../../infrastructure/repositories/productListViewRepository"
import {
  VariantCreatedEvent,
  VariantArchivedEvent,
  VariantDetailsUpdatedEvent,
  VariantPriceUpdatedEvent,
  VariantInventoryUpdatedEvent,
  VariantSkuUpdatedEvent,
  VariantPublishedEvent
} from "../../domain/variant/events"
import type { VariantEvent } from "../../domain/variant/events";
import {
  ProductCreatedEvent,
  ProductArchivedEvent,
  ProductPublishedEvent,
  ProductUnpublishedEvent,
  ProductSlugChangedEvent,
  ProductDetailsUpdatedEvent,
  ProductMetadataUpdatedEvent,
  ProductClassificationUpdatedEvent,
  ProductTagsUpdatedEvent,
  ProductCollectionsUpdatedEvent,
  ProductVariantOptionsUpdatedEvent,
  ProductFulfillmentTypeUpdatedEvent,
  ProductUpdateProductTaxDetailsEvent
} from "../../domain/product/events"
import type { ProductEvent, ProductState } from "../../domain/product/events";
import { ProductAggregate } from "../../domain/product/aggregate";
import { assertNever } from "../../lib/assertNever";


export class ProductVariantProjection {
  constructor(private repositories: UnitOfWorkRepositories) { }

  private async getProductMetadata(
    productId: string
  ): Promise<ProductListViewData | null> {
    const { snapshotRepository, productListViewRepository } = this.repositories;
    // First try to get from product_list_view
    const productData = productListViewRepository.findByProductId(productId);
    if (productData) {
      return productData;
    }

    // Fallback to snapshot
    const snapshot = snapshotRepository.getSnapshot(productId);
    if (!snapshot) {
      return null;
    }
    const productAggregate = ProductAggregate.loadFromSnapshot(snapshot);
    const snapshotData = productAggregate.toSnapshot();

    return {
      aggregate_id: productAggregate.id,
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
      fulfillment_type: snapshotData.fulfillmentType,
      dropship_safety_buffer: snapshotData.dropshipSafetyBuffer ?? null,
      variant_options: snapshotData.variantOptions,
    };
  }

  async execute(
    event: ProductEvent | VariantEvent
  ): Promise<void> {
    const { snapshotRepository, productVariantRepository, productListViewRepository } = this.repositories;
    switch (event.eventName) {
      case "variant.created": {
        const variantCreatedEvent = event as VariantCreatedEvent;
        const variantState = variantCreatedEvent.payload.newState;

        // Look up product metadata
        const productData = await this.getProductMetadata(variantState.productId);
        if (!productData) {
          break;
        }

        // Save product-variant relationship
        productVariantRepository.save(productData, variantCreatedEvent.aggregateId);
        break;
      }
      case "variant.archived": {
        const variantArchivedEvent = event as VariantArchivedEvent;

        // Delete product-variant relationship
        productVariantRepository.deleteByVariant(variantArchivedEvent.aggregateId);
        break;
      }
      case "variant.details_updated":
      case "variant.price_updated":
      case "variant.inventory_updated":
      case "variant.sku_updated":
      case "variant.published":
      case "variant.images_updated":
      case "variant.digital_asset_attached":
      case "variant.digital_asset_detached": {
        // When variant is updated or published, refresh the product-variant relationship
        const variantEvent = event as VariantDetailsUpdatedEvent | VariantPriceUpdatedEvent | VariantInventoryUpdatedEvent | VariantSkuUpdatedEvent | VariantPublishedEvent;
        const variantState = variantEvent.payload.newState;

        // Look up product metadata
        const productData = await this.getProductMetadata(variantState.productId);
        if (!productData) {
          break;
        }

        // Update product-variant relationship
        productVariantRepository.save(productData, variantEvent.aggregateId);
        break;
      }
      case "product.created":
      case "product.archived":
      case "product.published":
      case "product.unpublished":
      case "product.slug_changed":
      case "product.details_updated":
      case "product.metadata_updated":
      case "product.classification_updated":
      case "product.tags_updated":
      case "product.collections_updated":
      case "product.variant_options_updated":
      case "product.fulfillment_type_updated": {
        // When a product is created/updated, update all variant projections that reference it
        const productEvent = event as ProductCreatedEvent | ProductArchivedEvent | ProductPublishedEvent | ProductUnpublishedEvent | ProductSlugChangedEvent | ProductDetailsUpdatedEvent | ProductMetadataUpdatedEvent | ProductClassificationUpdatedEvent | ProductTagsUpdatedEvent | ProductCollectionsUpdatedEvent | ProductVariantOptionsUpdatedEvent | ProductFulfillmentTypeUpdatedEvent;
        const productId = productEvent.aggregateId;
        const productState = productEvent.payload.newState as ProductState;

        // Get updated product metadata
        const productData = await this.getProductMetadata(productId);
        if (!productData) {
          break;
        }

        // Delete all existing product-variant relationships for this product
        productVariantRepository.deleteByProduct(productId);

        // Insert one row per variant with full product data (only for valid variants)
        for (const variantId of productState.variantIds) {
          // Check if variant exists and is active
          const variantSnapshot = snapshotRepository.getSnapshot(variantId);
          if (variantSnapshot) {
            try {
              const variantPayload = JSON.parse(variantSnapshot.payload);
              if (variantPayload.status !== "archived") {
                productVariantRepository.save(productData, variantId);
              }
            } catch {
              // Skip invalid snapshots
            }
          }
        }
        break;
      }
      case "product.update_product_tax_details": {
        const productUpdateProductTaxDetailsEvent = event as ProductUpdateProductTaxDetailsEvent;
        const productId = productUpdateProductTaxDetailsEvent.aggregateId;
        const productState = productUpdateProductTaxDetailsEvent.payload.newState as ProductState;

        // Get updated product metadata
        const productData = await this.getProductMetadata(productId);
        if (!productData) {
          break;
        }

        // Delete all existing product-variant relationships for this product
        productVariantRepository.deleteByProduct(productId);

        // Insert one row per variant with full product data (only for valid variants)
        for (const variantId of productState.variantIds) {
          // Check if variant exists and is active
          const variantSnapshot = snapshotRepository.getSnapshot(variantId);
          if (variantSnapshot) {
            try {
              const variantPayload = JSON.parse(variantSnapshot.payload);
              if (variantPayload.status !== "archived") {
                productVariantRepository.save(productData, variantId);
              }
            } catch {
              // Skip invalid snapshots
            }
          }
        }
        break;
      }
      default:
        assertNever(event);
    }
  }
}
