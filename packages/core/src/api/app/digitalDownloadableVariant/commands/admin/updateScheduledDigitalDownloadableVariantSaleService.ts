import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { UpdateScheduledDigitalDownloadableVariantSaleCommand } from "./commands";
import { DigitalDownloadableVariantAggregate } from "../../../../domain/digitalDownloadableVariant/aggregate";
import { randomUUIDv7 } from "bun";

export class UpdateScheduledDigitalDownloadableVariantSaleService {
  constructor(private unitOfWork: UnitOfWork) {}

  async execute(command: UpdateScheduledDigitalDownloadableVariantSaleCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } = repositories;

      // Load and validate variant
      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error(`Digital downloadable variant with id ${command.id} not found`);
      }
      if (snapshot.version !== command.expectedVersion) {
        throw new Error(
          `Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${snapshot.version}`
        );
      }

      const variantAggregate = DigitalDownloadableVariantAggregate.loadFromSnapshot(snapshot);

      // Update the scheduled sale on the variant
      variantAggregate.updateScheduledSale(
        {
          startDate: command.startDate,
          endDate: command.endDate,
          saleType: command.saleType,
          saleValue: command.saleValue,
        },
        command.userId
      );

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
