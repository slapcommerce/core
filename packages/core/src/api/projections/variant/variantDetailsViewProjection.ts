import type { VariantEvent, VariantArchivedEvent } from "../../domain/variant/events";
import type { VariantDetailsViewData } from "../../infrastructure/repositories/variantDetailsViewRepository"
import type { VariantState } from "../../domain/variant/events"
import { Projection } from "../_base/projection";

function createVariantDetailsViewData(
  aggregateId: string,
  correlationId: string,
  version: number,
  state: VariantState,
  updatedAt: Date
): VariantDetailsViewData {
  return {
    aggregate_id: aggregateId,
    product_id: state.productId,
    sku: state.sku,
    price: state.price,
    inventory: state.inventory,
    options: JSON.stringify(state.options),
    status: state.status,
    correlation_id: correlationId,
    version: version,
    created_at: state.createdAt,
    updated_at: updatedAt,
    images: state.images ? JSON.stringify(state.images.toJSON()) : null,
    digital_asset: state.digitalAsset ? JSON.stringify(state.digitalAsset) : null,
  }
}

export class VariantDetailsViewProjection extends Projection<VariantEvent> {
  protected handlers = {
    'variant.created': this.updateView.bind(this),
    'variant.archived': this.handleArchived.bind(this),
    'variant.details_updated': this.updateView.bind(this),
    'variant.price_updated': this.updateView.bind(this),
    'variant.inventory_updated': this.updateView.bind(this),
    'variant.sku_updated': this.updateView.bind(this),
    'variant.published': this.updateView.bind(this),
    'variant.images_updated': this.updateView.bind(this),
    'variant.digital_asset_attached': this.updateView.bind(this),
    'variant.digital_asset_detached': this.updateView.bind(this),
  };

  private async updateView(event: VariantEvent): Promise<void> {
    const { variantDetailsViewRepository } = this.repositories;
    const state = event.payload.newState;

    const variantData = createVariantDetailsViewData(
      event.aggregateId,
      event.correlationId,
      event.version,
      state,
      event.occurredAt
    );

    variantDetailsViewRepository.save(variantData);
  }

  private async handleArchived(event: VariantArchivedEvent): Promise<void> {
    const { variantDetailsViewRepository } = this.repositories;
    variantDetailsViewRepository.deleteByVariant(event.aggregateId);
  }
}
