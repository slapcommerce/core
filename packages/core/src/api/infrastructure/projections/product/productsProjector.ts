import type { ProductEvent } from "../../../domain/product/events";
import { Projector, type ProjectorHandlers } from "../_base/projector";
import type { UnitOfWorkRepositories } from "../../unitOfWork";

export class ProductsProjector extends Projector<ProductEvent> {
  protected handlers: ProjectorHandlers<ProductEvent["eventName"]>;

  constructor(repositories: UnitOfWorkRepositories) {
    super(repositories);
    this.handlers = {
      "product.created": this.project.bind(this),
      "product.archived": this.project.bind(this),
      "product.published": this.project.bind(this),
      "product.unpublished": this.project.bind(this),
      "product.slug_changed": this.project.bind(this),
      "product.details_updated": this.project.bind(this),
      "product.metadata_updated": this.project.bind(this),
      "product.classification_updated": this.project.bind(this),
      "product.tags_updated": this.project.bind(this),
      "product.collections_updated": this.project.bind(this),
      "product.fulfillment_type_updated": this.project.bind(this),
      "product.variant_options_updated": this.project.bind(this),
      "product.update_product_tax_details": this.project.bind(this),
      "product.collection_positions_updated": this.project.bind(this),
    };
  }

  private async project(event: ProductEvent): Promise<void> {
    // ProductState doesn't include id, correlationId, version in its type definition
    // but has [key: string]: any, so we augment the state with event metadata
    const state = {
      ...event.payload.newState,
      id: event.aggregateId,
      correlationId: event.correlationId,
      version: event.version,
    };
    this.repositories.productsReadModelRepository.save(state);
  }
}
