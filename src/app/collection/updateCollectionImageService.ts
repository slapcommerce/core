import type { UnitOfWork } from "../../infrastructure/unitOfWork";
import type { UpdateCollectionImageCommand } from "./commands";
import type { ImageUploadHelper } from "../../infrastructure/imageUploadHelper";
import { CollectionAggregate } from "../../domain/collection/aggregate";
import { randomUUIDv7 } from "bun";
import type { AccessLevel } from "../accessLevel";

export class UpdateCollectionImageService {
  accessLevel: AccessLevel = "admin";

  constructor(
    private unitOfWork: UnitOfWork,

    private imageUploadHelper: ImageUploadHelper
  ) { }

  async execute(command: UpdateCollectionImageCommand) {
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

      // Load aggregate
      const collectionAggregate = CollectionAggregate.loadFromSnapshot(snapshot);
      const currentImages = collectionAggregate.images;

      // Find position of image to replace
      const imageArray = currentImages.toArray();
      const oldImageIndex = imageArray.findIndex(img => img.imageId === command.imageId);

      if (oldImageIndex === -1) {
        throw new Error(`Image with id ${command.imageId} not found in collection`);
      }

      // Upload new image
      const base64Data = command.imageData.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0)).buffer;

      const uploadResult = await this.imageUploadHelper.uploadImage(
        buffer,
        command.filename,
        command.contentType
      );

      // Remove old image and add new image
      let updatedImages = currentImages.removeImage(command.imageId);
      updatedImages = updatedImages.addImage(uploadResult, command.altText);

      // Reorder to maintain position (new image is at end, move to old position)
      const newImageArray = updatedImages.toArray();
      const newImageId = uploadResult.imageId;

      // Build new order with new image at old position
      const orderedIds: string[] = [];

      for (let i = 0; i < imageArray.length; i++) {
        if (i === oldImageIndex) {
          // Insert new image at old position (skip the old image being replaced)
          orderedIds.push(newImageId);
        } else {
          // Keep other images in their original positions
          const img = imageArray[i];
          if (img) {
            orderedIds.push(img.imageId);
          }
        }
      }

      updatedImages = updatedImages.reorder(orderedIds);
      collectionAggregate.updateImages(updatedImages, command.userId);

      // Persist events
      for (const event of collectionAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Update snapshot
      snapshotRepository.saveSnapshot({
        aggregate_id: collectionAggregate.id,
        correlation_id: snapshot.correlation_id,
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
