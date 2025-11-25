import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { AddVariantImageCommand } from "./commands";
import type { ImageUploadHelper } from "../../../../infrastructure/imageUploadHelper";
import { VariantAggregate } from "../../../../domain/variant/aggregate";
import { randomUUIDv7 } from "bun";
import type { Service } from "../../../service";

export class AddVariantImageService implements Service<AddVariantImageCommand> {

  constructor(
    private unitOfWork: UnitOfWork,

    private imageUploadHelper: ImageUploadHelper
  ) {}

  async execute(command: AddVariantImageCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } =
        repositories;

      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error(`Variant with id ${command.id} not found`);
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
      const variantAggregate = VariantAggregate.loadFromSnapshot(snapshot);
      const currentImages = variantAggregate.images;
      const updatedImages = currentImages.addImage(uploadResult, command.altText);
      variantAggregate.updateImages(updatedImages, command.userId);

      // Persist events
      for (const event of variantAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Update snapshot
      snapshotRepository.saveSnapshot({
        aggregate_id: variantAggregate.id,
        correlation_id: snapshot.correlation_id,
        version: variantAggregate.version,
        payload: variantAggregate.toSnapshot(),
      });

      // Add to outbox
      for (const event of variantAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }
}
