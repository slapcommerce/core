import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { AddDropshipVariantImageCommand } from "./commands";
import type { ImageUploadHelper } from "../../../../infrastructure/imageUploadHelper";
import { DropshipVariantAggregate } from "../../../../domain/dropshipVariant/aggregate";
import { randomUUIDv7 } from "bun";
import type { Service } from "../../../service";

export class AddDropshipVariantImageService implements Service<AddDropshipVariantImageCommand> {

  constructor(
    private unitOfWork: UnitOfWork,
    private imageUploadHelper: ImageUploadHelper
  ) {}

  async execute(command: AddDropshipVariantImageCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } = repositories;

      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error(`Dropship variant with id ${command.id} not found`);
      }
      if (snapshot.version !== command.expectedVersion) {
        throw new Error(`Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${snapshot.version}`);
      }

      // Decode base64 and upload image
      const base64Data = command.imageData.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0)).buffer;

      const uploadResult = await this.imageUploadHelper.uploadImage(
        buffer,
        command.filename,
        command.contentType
      );

      const variantAggregate = DropshipVariantAggregate.loadFromSnapshot(snapshot);

      // Get current images and add new one
      const currentImages = variantAggregate.images;
      const updatedImages = currentImages.addImage(uploadResult, command.altText);

      variantAggregate.updateImages(updatedImages, command.userId);

      for (const event of variantAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      snapshotRepository.saveSnapshot({
        aggregateId: variantAggregate.id,
        correlationId: snapshot.correlationId,
        version: variantAggregate.version,
        payload: variantAggregate.toSnapshot(),
      });

      for (const event of variantAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }
}
