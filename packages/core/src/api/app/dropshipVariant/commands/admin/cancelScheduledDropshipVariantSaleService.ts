import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { CancelScheduledDropshipVariantSaleCommand } from "./commands";
import { DropshipVariantAggregate } from "../../../../domain/dropshipVariant/aggregate";
import { randomUUIDv7 } from "bun";

export class CancelScheduledDropshipVariantSaleService {
  constructor(private unitOfWork: UnitOfWork) {}

  async execute(command: CancelScheduledDropshipVariantSaleCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } = repositories;

      // Load and validate variant
      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error(`Dropship variant with id ${command.id} not found`);
      }
      if (snapshot.version !== command.expectedVersion) {
        throw new Error(
          `Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${snapshot.version}`
        );
      }

      const variantAggregate = DropshipVariantAggregate.loadFromSnapshot(snapshot);

      // Cancel the scheduled sale on the variant
      variantAggregate.cancelScheduledSale(command.userId);

      // Persist events
      for (const event of variantAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Save snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: variantAggregate.id,
        correlationId: randomUUIDv7(),
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
