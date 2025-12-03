import type { DropshipVariantEvent, DropshipVariantState } from "../../../domain/dropshipVariant/events";
import type { DigitalDownloadableVariantEvent, DigitalDownloadableVariantState } from "../../../domain/digitalDownloadableVariant/events";
import type { DropshipProductEvent, DropshipProductState } from "../../../domain/dropshipProduct/events";
import type { DigitalDownloadableProductEvent, DigitalDownloadableProductState } from "../../../domain/digitalDownloadableProduct/events";
import type { VariantPositionsWithinProductEvent } from "../../../domain/variantPositionsWithinProduct/events";
import { Projector, type ProjectorHandlers } from "../_base/projector";
import type { UnitOfWorkRepositories } from "../../unitOfWork";
import type { ProductFieldsForVariant } from "../../repositories/readModels/productVariantsReadModelRepository";

type AllVariantEvent = DropshipVariantEvent | DigitalDownloadableVariantEvent;
type AllProductEvent = DropshipProductEvent | DigitalDownloadableProductEvent;
type AllProductState = DropshipProductState | DigitalDownloadableProductState;
type AllVariantState = DropshipVariantState | DigitalDownloadableVariantState;

type ProductVariantsEvent = AllVariantEvent | AllProductEvent | VariantPositionsWithinProductEvent;

export class ProductVariantsProjector extends Projector<ProductVariantsEvent> {
  protected handlers: ProjectorHandlers<ProductVariantsEvent["eventName"]>;

  constructor(repositories: UnitOfWorkRepositories) {
    super(repositories);
    this.handlers = {
      // Dropship variant events (12)
      "dropship_variant.created": this.handleVariantChange.bind(this),
      "dropship_variant.archived": this.handleVariantChange.bind(this),
      "dropship_variant.published": this.handleVariantChange.bind(this),
      "dropship_variant.details_updated": this.handleVariantChange.bind(this),
      "dropship_variant.price_updated": this.handleVariantChange.bind(this),
      "dropship_variant.sale_updated": this.handleVariantChange.bind(this),
      "dropship_variant.sku_updated": this.handleVariantChange.bind(this),
      "dropship_variant.inventory_updated": this.handleVariantChange.bind(this),
      "dropship_variant.images_updated": this.handleVariantChange.bind(this),
      "dropship_variant.fulfillment_settings_updated": this.handleVariantChange.bind(this),
      "dropship_variant.drop_scheduled": this.handleVariantChange.bind(this),
      "dropship_variant.dropped": this.handleVariantChange.bind(this),
      "dropship_variant.scheduled_drop_updated": this.handleVariantChange.bind(this),
      "dropship_variant.scheduled_drop_cancelled": this.handleVariantChange.bind(this),
      "dropship_variant.sale_scheduled": this.handleVariantChange.bind(this),
      "dropship_variant.scheduled_sale_started": this.handleVariantChange.bind(this),
      "dropship_variant.scheduled_sale_ended": this.handleVariantChange.bind(this),
      "dropship_variant.scheduled_sale_updated": this.handleVariantChange.bind(this),
      "dropship_variant.scheduled_sale_cancelled": this.handleVariantChange.bind(this),

      // Digital downloadable variant events (13)
      "digital_downloadable_variant.created": this.handleVariantChange.bind(this),
      "digital_downloadable_variant.archived": this.handleVariantChange.bind(this),
      "digital_downloadable_variant.published": this.handleVariantChange.bind(this),
      "digital_downloadable_variant.details_updated": this.handleVariantChange.bind(this),
      "digital_downloadable_variant.price_updated": this.handleVariantChange.bind(this),
      "digital_downloadable_variant.sale_updated": this.handleVariantChange.bind(this),
      "digital_downloadable_variant.sku_updated": this.handleVariantChange.bind(this),
      "digital_downloadable_variant.images_updated": this.handleVariantChange.bind(this),
      "digital_downloadable_variant.digital_asset_attached": this.handleVariantChange.bind(this),
      "digital_downloadable_variant.digital_asset_detached": this.handleVariantChange.bind(this),
      "digital_downloadable_variant.download_settings_updated": this.handleVariantChange.bind(this),
      "digital_downloadable_variant.drop_scheduled": this.handleVariantChange.bind(this),
      "digital_downloadable_variant.dropped": this.handleVariantChange.bind(this),
      "digital_downloadable_variant.scheduled_drop_updated": this.handleVariantChange.bind(this),
      "digital_downloadable_variant.scheduled_drop_cancelled": this.handleVariantChange.bind(this),
      "digital_downloadable_variant.sale_scheduled": this.handleVariantChange.bind(this),
      "digital_downloadable_variant.scheduled_sale_started": this.handleVariantChange.bind(this),
      "digital_downloadable_variant.scheduled_sale_ended": this.handleVariantChange.bind(this),
      "digital_downloadable_variant.scheduled_sale_updated": this.handleVariantChange.bind(this),
      "digital_downloadable_variant.scheduled_sale_cancelled": this.handleVariantChange.bind(this),

      // Dropship product events (17)
      "dropship_product.created": this.handleProductChange.bind(this),
      "dropship_product.archived": this.handleProductChange.bind(this),
      "dropship_product.published": this.handleProductChange.bind(this),
      "dropship_product.unpublished": this.handleProductChange.bind(this),
      "dropship_product.slug_changed": this.handleProductChange.bind(this),
      "dropship_product.details_updated": this.handleProductChange.bind(this),
      "dropship_product.metadata_updated": this.handleProductChange.bind(this),
      "dropship_product.classification_updated": this.handleProductChange.bind(this),
      "dropship_product.tags_updated": this.handleProductChange.bind(this),
      "dropship_product.collections_updated": this.handleProductChange.bind(this),
      "dropship_product.variant_options_updated": this.handleProductChange.bind(this),
      "dropship_product.tax_details_updated": this.handleProductChange.bind(this),
      "dropship_product.default_variant_set": this.handleProductChange.bind(this),
      "dropship_product.safety_buffer_updated": this.handleProductChange.bind(this),
      "dropship_product.fulfillment_settings_updated": this.handleProductChange.bind(this),
      "dropship_product.drop_scheduled": this.handleProductChange.bind(this),
      "dropship_product.dropped": this.handleProductChange.bind(this),
      "dropship_product.scheduled_drop_updated": this.handleProductChange.bind(this),
      "dropship_product.scheduled_drop_cancelled": this.handleProductChange.bind(this),

      // Digital downloadable product events (16)
      "digital_downloadable_product.created": this.handleProductChange.bind(this),
      "digital_downloadable_product.archived": this.handleProductChange.bind(this),
      "digital_downloadable_product.published": this.handleProductChange.bind(this),
      "digital_downloadable_product.unpublished": this.handleProductChange.bind(this),
      "digital_downloadable_product.slug_changed": this.handleProductChange.bind(this),
      "digital_downloadable_product.details_updated": this.handleProductChange.bind(this),
      "digital_downloadable_product.metadata_updated": this.handleProductChange.bind(this),
      "digital_downloadable_product.classification_updated": this.handleProductChange.bind(this),
      "digital_downloadable_product.tags_updated": this.handleProductChange.bind(this),
      "digital_downloadable_product.collections_updated": this.handleProductChange.bind(this),
      "digital_downloadable_product.variant_options_updated": this.handleProductChange.bind(this),
      "digital_downloadable_product.tax_details_updated": this.handleProductChange.bind(this),
      "digital_downloadable_product.default_variant_set": this.handleProductChange.bind(this),
      "digital_downloadable_product.download_settings_updated": this.handleProductChange.bind(this),
      "digital_downloadable_product.drop_scheduled": this.handleProductChange.bind(this),
      "digital_downloadable_product.dropped": this.handleProductChange.bind(this),
      "digital_downloadable_product.scheduled_drop_updated": this.handleProductChange.bind(this),
      "digital_downloadable_product.scheduled_drop_cancelled": this.handleProductChange.bind(this),

      // VariantPositionsWithinProduct events (5)
      "variantPositionsWithinProduct.created": this.handlePositionsChange.bind(this),
      "variantPositionsWithinProduct.reordered": this.handlePositionsChange.bind(this),
      "variantPositionsWithinProduct.variant_added": this.handlePositionsChange.bind(this),
      "variantPositionsWithinProduct.variant_removed": this.handlePositionsChange.bind(this),
      "variantPositionsWithinProduct.archived": this.handlePositionsChange.bind(this),
    };
  }

  private handleVariantChange(event: AllVariantEvent): void {
    const state = event.payload.newState as AllVariantState;
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

  private handleProductChange(event: AllProductEvent): void {
    const state = event.payload.newState as AllProductState;
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

  private productStateToFields(state: AllProductState): ProductFieldsForVariant {
    return {
      productName: state.name,
      productSlug: state.slug,
      productDescription: state.description,
      productStatus: state.status,
      productVendor: state.vendor,
      productType: state.productType === "dropship" ? "dropship" : "digital",
      dropshipSafetyBuffer: state.productType === "dropship" ? state.dropshipSafetyBuffer : undefined,
      fulfillmentProviderId: state.productType === "dropship" ? state.fulfillmentProviderId : null,
      supplierCost: state.productType === "dropship" ? state.supplierCost : null,
      supplierSku: state.productType === "dropship" ? state.supplierSku : null,
      maxDownloads: state.productType === "digital_downloadable" ? state.maxDownloads : null,
      accessDurationDays: state.productType === "digital_downloadable" ? state.accessDurationDays : null,
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
