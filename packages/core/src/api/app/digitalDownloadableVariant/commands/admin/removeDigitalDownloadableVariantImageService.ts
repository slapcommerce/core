import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { RemoveDigitalDownloadableVariantImageCommand } from "./commands";
import { DigitalDownloadableVariantAggregate } from "../../../../domain/digitalDownloadableVariant/aggregate";
import { randomUUIDv7 } from "bun";
import type { Service } from "../../../service";

export class RemoveDigitalDownloadableVariantImageService implements Service<RemoveDigitalDownloadableVariantImageCommand> {

  constructor(private unitOfWork: UnitOfWork) {}

  async execute(command: RemoveDigitalDownloadableVariantImageCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } = repositories;

      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error(`Digital downloadable variant with id ${command.id} not found`);
      }
      if (snapshot.version !== command.expectedVersion) {
        throw new Error(`Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${snapshot.version}`);
      }

      const variantAggregate = DigitalDownloadableVariantAggregate.loadFromSnapshot(snapshot);

      // Get current images and remove the specified one
      const currentImages = variantAggregate.images;
      const updatedImages = currentImages.removeImage(command.imageId);

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
