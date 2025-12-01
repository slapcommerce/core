import type { DropshipProductEvent } from "../../../domain/dropshipProduct/events";
import type { DigitalDownloadableProductEvent } from "../../../domain/digitalDownloadableProduct/events";
import { Projector, type ProjectorHandlers } from "../_base/projector";
import type { UnitOfWorkRepositories } from "../../unitOfWork";

type AllProductEvent = DropshipProductEvent | DigitalDownloadableProductEvent;

export class ProductsProjector extends Projector<AllProductEvent> {
  protected handlers: ProjectorHandlers<AllProductEvent["eventName"]>;

  constructor(repositories: UnitOfWorkRepositories) {
    super(repositories);
    this.handlers = {
      // Dropship product handlers (15)
      "dropship_product.created": this.project.bind(this),
      "dropship_product.archived": this.project.bind(this),
      "dropship_product.published": this.project.bind(this),
      "dropship_product.unpublished": this.project.bind(this),
      "dropship_product.slug_changed": this.project.bind(this),
      "dropship_product.details_updated": this.project.bind(this),
      "dropship_product.metadata_updated": this.project.bind(this),
      "dropship_product.classification_updated": this.project.bind(this),
      "dropship_product.tags_updated": this.project.bind(this),
      "dropship_product.collections_updated": this.project.bind(this),
      "dropship_product.variant_options_updated": this.project.bind(this),
      "dropship_product.tax_details_updated": this.project.bind(this),
      "dropship_product.default_variant_set": this.project.bind(this),
      "dropship_product.safety_buffer_updated": this.project.bind(this),
      "dropship_product.fulfillment_settings_updated": this.project.bind(this),

      // Digital downloadable product handlers (14)
      "digital_downloadable_product.created": this.project.bind(this),
      "digital_downloadable_product.archived": this.project.bind(this),
      "digital_downloadable_product.published": this.project.bind(this),
      "digital_downloadable_product.unpublished": this.project.bind(this),
      "digital_downloadable_product.slug_changed": this.project.bind(this),
      "digital_downloadable_product.details_updated": this.project.bind(this),
      "digital_downloadable_product.metadata_updated": this.project.bind(this),
      "digital_downloadable_product.classification_updated": this.project.bind(this),
      "digital_downloadable_product.tags_updated": this.project.bind(this),
      "digital_downloadable_product.collections_updated": this.project.bind(this),
      "digital_downloadable_product.variant_options_updated": this.project.bind(this),
      "digital_downloadable_product.tax_details_updated": this.project.bind(this),
      "digital_downloadable_product.default_variant_set": this.project.bind(this),
      "digital_downloadable_product.download_settings_updated": this.project.bind(this),
    };
  }

  private async project(event: AllProductEvent): Promise<void> {
    const state = {
      ...event.payload.newState,
      id: event.aggregateId,
      correlationId: event.correlationId,
      version: event.version,
    };
    this.repositories.productsReadModelRepository.save(state);
  }
}
