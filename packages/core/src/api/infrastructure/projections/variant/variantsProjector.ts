import type { VariantEvent } from "../../../domain/variant/events";
import { Projector, type ProjectorHandlers } from "../_base/projector";
import type { UnitOfWorkRepositories } from "../../unitOfWork";

export class VariantsProjector extends Projector<VariantEvent> {
  protected handlers: ProjectorHandlers<VariantEvent['eventName']>;

  constructor(repositories: UnitOfWorkRepositories) {
    super(repositories);
    this.handlers = {
      'variant.created': this.project.bind(this),
      'variant.archived': this.project.bind(this),
      'variant.details_updated': this.project.bind(this),
      'variant.price_updated': this.project.bind(this),
      'variant.inventory_updated': this.project.bind(this),
      'variant.sku_updated': this.project.bind(this),
      'variant.published': this.project.bind(this),
      'variant.images_updated': this.project.bind(this),
      'variant.digital_asset_attached': this.project.bind(this),
      'variant.digital_asset_detached': this.project.bind(this),
    };
  }

  private async project(event: VariantEvent): Promise<void> {
    // VariantState doesn't include id, correlationId, version in its type definition
    // but has [key: string]: any, so we augment the state with event metadata
    const state = {
      ...event.payload.newState,
      id: event.aggregateId,
      correlationId: event.correlationId,
      version: event.version,
    };
    this.repositories.variantsReadModelRepository.save(state);
  }
}
