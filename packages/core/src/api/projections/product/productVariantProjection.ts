import type { ProductListViewData } from "../../infrastructure/repositories/productListViewRepository"
import type { VariantEvent, VariantArchivedEvent } from "../../domain/variant/events";
import type { ProductEvent } from "../../domain/product/events";
import { ProductAggregate } from "../../domain/product/aggregate";
import { Projection } from "../_base/projection";

export class ProductVariantProjection extends Projection<ProductEvent | VariantEvent> {
  protected handlers = {
    'variant.created': this.handleVariantCreatedOrUpdated.bind(this),
    'variant.archived': this.handleVariantArchived.bind(this),
    'variant.details_updated': this.handleVariantCreatedOrUpdated.bind(this),
    'variant.price_updated': this.handleVariantCreatedOrUpdated.bind(this),
    'variant.inventory_updated': this.handleVariantCreatedOrUpdated.bind(this),
    'variant.sku_updated': this.handleVariantCreatedOrUpdated.bind(this),
    'variant.published': this.handleVariantCreatedOrUpdated.bind(this),
    'variant.images_updated': this.handleVariantCreatedOrUpdated.bind(this),
    'variant.digital_asset_attached': this.handleVariantCreatedOrUpdated.bind(this),
    'variant.digital_asset_detached': this.handleVariantCreatedOrUpdated.bind(this),
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
  };

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

  private async handleVariantCreatedOrUpdated(event: VariantEvent): Promise<void> {
    const { productVariantRepository } = this.repositories;
    const variantState = event.payload.newState;

    // Look up product metadata
    const productData = await this.getProductMetadata(variantState.productId);
    if (!productData) {
      return;
    }

    // Save product-variant relationship
    productVariantRepository.save(productData, event.aggregateId);
  }

  private async handleVariantArchived(event: VariantArchivedEvent): Promise<void> {
    const { productVariantRepository } = this.repositories;
    // Delete product-variant relationship
    productVariantRepository.deleteByVariant(event.aggregateId);
  }

  private async handleProductEvent(event: ProductEvent): Promise<void> {
    const { snapshotRepository, productVariantRepository } = this.repositories;
    const productId = event.aggregateId;
    const productState = event.payload.newState;

    // Get updated product metadata
    const productData = await this.getProductMetadata(productId);
    if (!productData) {
      return;
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
  }
}
