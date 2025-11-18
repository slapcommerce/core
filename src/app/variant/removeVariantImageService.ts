import type { UnitOfWork } from "../../infrastructure/unitOfWork";
import type { RemoveVariantImageCommand } from "./commands";
import type { ProjectionService } from "../../infrastructure/projectionService";
import { VariantAggregate } from "../../domain/variant/aggregate";
import { randomUUIDv7 } from "bun";

export class RemoveVariantImageService {
  constructor(
    private unitOfWork: UnitOfWork,
    private projectionService: ProjectionService
  ) {}

  async execute(command: RemoveVariantImageCommand) {
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

      // Load aggregate and remove image
      const variantAggregate = VariantAggregate.loadFromSnapshot(snapshot);
      const currentImages = variantAggregate.toSnapshot().images;
      const updatedImages = currentImages.removeImage(command.imageId);
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
        success: true,
      };
    });
  }
}
