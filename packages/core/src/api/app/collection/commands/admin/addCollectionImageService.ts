import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { AddCollectionImageCommand } from "./commands";
import type { ImageUploadHelper } from "../../../../infrastructure/imageUploadHelper";
import { CollectionAggregate } from "../../../../domain/collection/aggregate";
import { randomUUIDv7 } from "bun";

export class AddCollectionImageService {

  constructor(
    private unitOfWork: UnitOfWork,

    private imageUploadHelper: ImageUploadHelper
  ) {}

  async execute(command: AddCollectionImageCommand) {
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

      // Upload image
      const base64Data = command.imageData.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0)).buffer;

      const uploadResult = await this.imageUploadHelper.uploadImage(
        buffer,
        command.filename,
        command.contentType
      );

      // Load aggregate and add image
      const collectionAggregate = CollectionAggregate.loadFromSnapshot(snapshot);
      const currentImages = collectionAggregate.images;
      const updatedImages = currentImages.addImage(uploadResult, command.altText);
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
