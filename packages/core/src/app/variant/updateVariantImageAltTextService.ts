import type { UnitOfWork } from "../../infrastructure/unitOfWork";
import type { UpdateVariantImageAltTextCommand } from "./commands";
import { VariantAggregate } from "../../domain/variant/aggregate";
import { randomUUIDv7 } from "bun";
import type { AccessLevel } from "../accessLevel";
import type { Service } from "../service";

export class UpdateVariantImageAltTextService implements Service<UpdateVariantImageAltTextCommand> {
  accessLevel: AccessLevel = "admin";

  constructor(
    private unitOfWork: UnitOfWork,

  ) {}

  async execute(command: UpdateVariantImageAltTextCommand) {
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

      // Load aggregate and update alt text
      const variantAggregate = VariantAggregate.loadFromSnapshot(snapshot);
      const currentImages = variantAggregate.images;
      const updatedImages = currentImages.updateAltText(command.imageId, command.altText);
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
