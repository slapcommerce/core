import type { UnitOfWork } from "../../infrastructure/unitOfWork";
import type { AddVariantImageCommand } from "./commands";
import type { ProjectionService } from "../../infrastructure/projectionService";
import type { ImageUploadHelper } from "../../infrastructure/imageUploadHelper";
import { VariantAggregate } from "../../domain/variant/aggregate";
import { randomUUIDv7 } from "bun";

export class AddVariantImageService {
  constructor(
    private unitOfWork: UnitOfWork,
    private projectionService: ProjectionService,
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
      const currentImages = variantAggregate.toSnapshot().images;
      const updatedImages = currentImages.addImage(uploadResult, command.altText);
      variantAggregate.updateImages(updatedImages, command.userId);

      // Persist events
      for (const event of variantAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
        await this.projectionService.handleEvent(event, repositories);
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

      return {
        imageId: uploadResult.imageId,
        warning: updatedImages.isApproachingLimit()
          ? `You have ${updatedImages.count()} images. Consider limiting for better performance.`
          : null,
      };
    });
  }
}
