import type { BundleEvent } from "../../../domain/bundle/events";
import { Projector, type ProjectorHandlers } from "../_base/projector";
import type { UnitOfWorkRepositories } from "../../unitOfWork";

export class BundlesProjector extends Projector<BundleEvent> {
  protected handlers: ProjectorHandlers<BundleEvent["eventName"]>;

  constructor(repositories: UnitOfWorkRepositories) {
    super(repositories);
    this.handlers = {
      "bundle.created": this.project.bind(this),
      "bundle.archived": this.project.bind(this),
      "bundle.published": this.project.bind(this),
      "bundle.unpublished": this.project.bind(this),
      "bundle.items_updated": this.project.bind(this),
      "bundle.details_updated": this.project.bind(this),
      "bundle.metadata_updated": this.project.bind(this),
      "bundle.price_updated": this.project.bind(this),
      "bundle.collections_updated": this.project.bind(this),
      "bundle.images_updated": this.project.bind(this),
      "bundle.slug_changed": this.project.bind(this),
      "bundle.tax_details_updated": this.project.bind(this),
    };
  }

  private async project(event: BundleEvent): Promise<void> {
    const state = {
      ...event.payload.newState,
      id: event.aggregateId,
      correlationId: event.correlationId,
      version: event.version,
    };
    this.repositories.bundlesReadModelRepository.save(state);
  }
}
