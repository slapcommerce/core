import type { CollectionEvent } from "../../../domain/collection/events";
import { Projector } from "../_base/projector";

export class CollectionsProjector extends Projector<CollectionEvent> {
  protected handlers = {
    'collection.created': this.project.bind(this),
    'collection.archived': this.project.bind(this),
    'collection.metadata_updated': this.project.bind(this),
    'collection.published': this.project.bind(this),
    'collection.seo_metadata_updated': this.project.bind(this),
    'collection.unpublished': this.project.bind(this),
    'collection.images_updated': this.project.bind(this),
  };

  private async project(event: CollectionEvent): Promise<void> {
    const state = event.payload.newState;
    this.repositories.CollectionsReadModelRepository.save(state);
  }
}
