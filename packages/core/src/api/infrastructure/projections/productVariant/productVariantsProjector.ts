import type { VariantEvent } from "../../../domain/variant/events";
import type { ProductEvent, ProductState } from "../../../domain/product/events";
import type { VariantPositionsWithinProductEvent } from "../../../domain/variantPositionsWithinProduct/events";
import { Projector, type ProjectorHandlers } from "../_base/projector";
import type { UnitOfWorkRepositories } from "../../unitOfWork";
import type { ProductFieldsForVariant } from "../../repositories/readModels/productVariantsReadModelRepository";

type ProductVariantsEvent = VariantEvent | ProductEvent | VariantPositionsWithinProductEvent;

export class ProductVariantsProjector extends Projector<ProductVariantsEvent> {
  protected handlers: ProjectorHandlers<ProductVariantsEvent["eventName"]>;

  constructor(repositories: UnitOfWorkRepositories) {
    super(repositories);
    this.handlers = {
      // Variant events - update the variant's row with product data
      "variant.created": this.handleVariantChange.bind(this),
      "variant.archived": this.handleVariantChange.bind(this),
      "variant.details_updated": this.handleVariantChange.bind(this),
      "variant.price_updated": this.handleVariantChange.bind(this),
      "variant.inventory_updated": this.handleVariantChange.bind(this),
      "variant.sku_updated": this.handleVariantChange.bind(this),
      "variant.published": this.handleVariantChange.bind(this),
      "variant.images_updated": this.handleVariantChange.bind(this),
      "variant.digital_asset_attached": this.handleVariantChange.bind(this),
      "variant.digital_asset_detached": this.handleVariantChange.bind(this),

      // Product events - update product fields for all variants of the product
      "product.created": this.handleProductChange.bind(this),
      "product.archived": this.handleProductChange.bind(this),
      "product.published": this.handleProductChange.bind(this),
      "product.unpublished": this.handleProductChange.bind(this),
      "product.slug_changed": this.handleProductChange.bind(this),
      "product.details_updated": this.handleProductChange.bind(this),
      "product.metadata_updated": this.handleProductChange.bind(this),
      "product.classification_updated": this.handleProductChange.bind(this),
      "product.tags_updated": this.handleProductChange.bind(this),
      "product.collections_updated": this.handleProductChange.bind(this),
      "product.fulfillment_type_updated": this.handleProductChange.bind(this),
      "product.variant_options_updated": this.handleProductChange.bind(this),
      "product.update_product_tax_details": this.handleProductChange.bind(this),
      "product.default_variant_set": this.handleProductChange.bind(this),

      // VariantPositionsWithinProduct events - update positions
      "variantPositionsWithinProduct.created": this.handlePositionsChange.bind(this),
      "variantPositionsWithinProduct.reordered": this.handlePositionsChange.bind(this),
      "variantPositionsWithinProduct.variant_added": this.handlePositionsChange.bind(this),
      "variantPositionsWithinProduct.variant_removed": this.handlePositionsChange.bind(this),
      "variantPositionsWithinProduct.archived": this.handlePositionsChange.bind(this),
    };
  }

  private handleVariantChange(event: VariantEvent): void {
    const state = event.payload.newState;
    const variantId = event.aggregateId;
    const productId = state.productId;

    // Get product fields from productReadModel
    const productFields = this.repositories.productVariantsReadModelRepository.getProductFields(productId);

    if (!productFields) {
      // Product not found - this could happen if variant is created before product is projected
      // In practice, this shouldn't happen as products are created before variants
      return;
    }

    this.repositories.productVariantsReadModelRepository.saveFromVariantState(
      variantId,
      {
        ...state,
        correlationId: event.correlationId,
        version: event.version,
      },
      productFields,
    );
  }

  private handleProductChange(event: ProductEvent): void {
    const state = event.payload.newState;
    const productId = event.aggregateId;

    const productFields = this.productStateToFields(state);
    this.repositories.productVariantsReadModelRepository.updateProductFields(productId, productFields);
  }

  private handlePositionsChange(event: VariantPositionsWithinProductEvent): void {
    const state = event.payload.newState;
    const productId = state.productId;

    const positions = state.variantIds.map((variantId, index) => ({
      variantId,
      position: index,
    }));

    this.repositories.productVariantsReadModelRepository.updatePositions(productId, positions);
  }

  private productStateToFields(state: ProductState): ProductFieldsForVariant {
    return {
      productName: state.name,
      productSlug: state.slug,
      productDescription: state.description,
      productStatus: state.status,
      productVendor: state.vendor,
      fulfillmentType: state.fulfillmentType,
      dropshipSafetyBuffer: state.dropshipSafetyBuffer,
      defaultVariantId: state.defaultVariantId,
      variantOptions: state.variantOptions,
      collections: state.collections,
      tags: state.tags,
      taxable: state.taxable,
      taxId: state.taxId,
      metaTitle: state.metaTitle,
      metaDescription: state.metaDescription,
      richDescriptionUrl: state.richDescriptionUrl,
      productCreatedAt: state.createdAt,
      productUpdatedAt: state.updatedAt,
      productPublishedAt: state.publishedAt,
    };
  }
}
