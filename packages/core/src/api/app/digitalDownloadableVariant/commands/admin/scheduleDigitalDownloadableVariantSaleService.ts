import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { ScheduleDigitalDownloadableVariantSaleCommand } from "./commands";
import { DigitalDownloadableVariantAggregate } from "../../../../domain/digitalDownloadableVariant/aggregate";
import { randomUUIDv7 } from "bun";

export class ScheduleDigitalDownloadableVariantSaleService {
  constructor(private unitOfWork: UnitOfWork) {}

  async execute(command: ScheduleDigitalDownloadableVariantSaleCommand) {
    // Validate that endDate is after startDate
    if (command.endDate <= command.startDate) {
      throw new Error("Sale end date must be after start date");
    }

    let scheduleGroupId: string = "";
    await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } = repositories;

      // Load and validate variant
      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error(`Digital downloadable variant with id ${command.id} not found`);
      }
      if (snapshot.version !== command.expectedVersion) {
        throw new Error(`Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${snapshot.version}`);
      }

      const variantAggregate = DigitalDownloadableVariantAggregate.loadFromSnapshot(snapshot);

      // Generate IDs for the schedule
      scheduleGroupId = randomUUIDv7();
      const scheduleId = randomUUIDv7();
      const startScheduleId = randomUUIDv7();
      const endScheduleId = randomUUIDv7();

      // Schedule the sale on the variant
      variantAggregate.scheduleSale({
        id: scheduleId,
        scheduleGroupId,
        startScheduleId,
        endScheduleId,
        saleType: command.saleType,
        saleValue: command.saleValue,
        startDate: command.startDate,
        endDate: command.endDate,
        userId: command.userId,
      });

      // Persist events
      for (const event of variantAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Save snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: variantAggregate.id,
        correlationId: command.correlationId,
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

    return { scheduleGroupId };
  }
}
