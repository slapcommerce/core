import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { ReorderDropshipVariantImagesCommand } from "./commands";
import { DropshipVariantAggregate } from "../../../../domain/dropshipVariant/aggregate";
import { randomUUIDv7 } from "bun";
import type { Service } from "../../../service";

export class ReorderDropshipVariantImagesService implements Service<ReorderDropshipVariantImagesCommand> {

  constructor(private unitOfWork: UnitOfWork) {}

  async execute(command: ReorderDropshipVariantImagesCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } = repositories;

      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error(`Dropship variant with id ${command.id} not found`);
      }
      if (snapshot.version !== command.expectedVersion) {
        throw new Error(`Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${snapshot.version}`);
      }

      const variantAggregate = DropshipVariantAggregate.loadFromSnapshot(snapshot);

      // Get current images and reorder
      const currentImages = variantAggregate.images;
      const reorderedImages = currentImages.reorder(command.orderedImageIds);

      variantAggregate.updateImages(reorderedImages, command.userId);

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
