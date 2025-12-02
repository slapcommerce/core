import type { DropshipVariantEvent } from "../../../domain/dropshipVariant/events";
import type { DigitalDownloadableVariantEvent } from "../../../domain/digitalDownloadableVariant/events";
import { Projector, type ProjectorHandlers } from "../_base/projector";
import type { UnitOfWorkRepositories } from "../../unitOfWork";

type AllVariantEvent = DropshipVariantEvent | DigitalDownloadableVariantEvent;

export class VariantsProjector extends Projector<AllVariantEvent> {
  protected handlers: ProjectorHandlers<AllVariantEvent["eventName"]>;

  constructor(repositories: UnitOfWorkRepositories) {
    super(repositories);
    this.handlers = {
      // Dropship variant handlers (11)
      "dropship_variant.created": this.project.bind(this),
      "dropship_variant.archived": this.project.bind(this),
      "dropship_variant.published": this.project.bind(this),
      "dropship_variant.details_updated": this.project.bind(this),
      "dropship_variant.price_updated": this.project.bind(this),
      "dropship_variant.sku_updated": this.project.bind(this),
      "dropship_variant.inventory_updated": this.project.bind(this),
      "dropship_variant.images_updated": this.project.bind(this),
      "dropship_variant.fulfillment_settings_updated": this.project.bind(this),
      "dropship_variant.hidden_drop_scheduled": this.project.bind(this),
      "dropship_variant.visible_drop_scheduled": this.project.bind(this),

      // Digital downloadable variant handlers (12)
      "digital_downloadable_variant.created": this.project.bind(this),
      "digital_downloadable_variant.archived": this.project.bind(this),
      "digital_downloadable_variant.published": this.project.bind(this),
      "digital_downloadable_variant.details_updated": this.project.bind(this),
      "digital_downloadable_variant.price_updated": this.project.bind(this),
      "digital_downloadable_variant.sku_updated": this.project.bind(this),
      "digital_downloadable_variant.images_updated": this.project.bind(this),
      "digital_downloadable_variant.digital_asset_attached": this.project.bind(this),
      "digital_downloadable_variant.digital_asset_detached": this.project.bind(this),
      "digital_downloadable_variant.download_settings_updated": this.project.bind(this),
      "digital_downloadable_variant.hidden_drop_scheduled": this.project.bind(this),
      "digital_downloadable_variant.visible_drop_scheduled": this.project.bind(this),
    };
  }

  private async project(event: AllVariantEvent): Promise<void> {
    const state = {
      ...event.payload.newState,
      id: event.aggregateId,
      correlationId: event.correlationId,
      version: event.version,
    };
    this.repositories.variantsReadModelRepository.save(state);
  }
}
