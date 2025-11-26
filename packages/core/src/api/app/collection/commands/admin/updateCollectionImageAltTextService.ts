import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { UpdateCollectionImageAltTextCommand } from "./commands";
import { CollectionAggregate } from "../../../../domain/collection/aggregate";
import { randomUUIDv7 } from "bun";

export class UpdateCollectionImageAltTextService {

  constructor(
    private unitOfWork: UnitOfWork,

  ) {}

  async execute(command: UpdateCollectionImageAltTextCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } =
        repositories;

      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error(`Collection with id ${command.id} not found`);
      }

      if (snapshot.version !== command.expectedVersion) {
        throw new Error(
          `Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${snapshot.version}`
        );
      }

      // Load aggregate and update alt text
      const collectionAggregate = CollectionAggregate.loadFromSnapshot(snapshot);
      const currentImages = collectionAggregate.images;
      const updatedImages = currentImages.updateAltText(command.imageId, command.altText);
      collectionAggregate.updateImages(updatedImages, command.userId);

      // Persist events
      for (const event of collectionAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Update snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: collectionAggregate.id,
        correlationId: snapshot.correlationId,
        version: collectionAggregate.version,
        payload: collectionAggregate.toSnapshot(),
      });

      // Add to outbox
      for (const event of collectionAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }
}
