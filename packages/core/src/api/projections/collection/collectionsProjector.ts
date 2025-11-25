import type { CollectionsReadModel } from "../../infrastructure/repositories/collectionsReadModelRepository"
import type { CollectionState } from "../../domain/collection/events"
import type { CollectionEvent } from "../../domain/collection/events";
import { Projector } from "../_base/projector";

export class CollectionsListProjector extends Projector<CollectionEvent> {
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
    const readModel = this.toReadModel(
      event.aggregateId,
      event.correlationId,
      event.version,
      state,
      event.occurredAt
    );
    this.repositories.CollectionsReadModelRepository.save(readModel);
  }

  private toReadModel(
    aggregateId: string,
    correlationId: string,
    version: number,
    state: CollectionState,
    updatedAt: Date
  ): CollectionsReadModel {
    return {
      aggregate_id: aggregateId,
      name: state.name,
      slug: state.slug,
      description: state.description,
      status: state.status,
      correlation_id: correlationId,
      version: version,
      created_at: state.createdAt,
      updated_at: updatedAt,
      meta_title: state.metaTitle,
      meta_description: state.metaDescription,
      published_at: state.publishedAt,
      images: state.images ? JSON.stringify(state.images.toJSON()) : null,
    }
  }
}
