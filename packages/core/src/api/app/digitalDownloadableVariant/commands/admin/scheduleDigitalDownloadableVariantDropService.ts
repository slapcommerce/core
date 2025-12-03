import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { ScheduleDigitalDownloadableVariantDropCommand } from "./commands";
import { DigitalDownloadableVariantAggregate } from "../../../../domain/digitalDownloadableVariant/aggregate";
import { randomUUIDv7 } from "bun";

export class ScheduleDigitalDownloadableVariantDropService {
  constructor(private unitOfWork: UnitOfWork) {}

  async execute(command: ScheduleDigitalDownloadableVariantDropCommand) {
    let scheduleId: string = "";
    await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } =
        repositories;

      // Load and validate variant
      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error(
          `Digital downloadable variant with id ${command.id} not found`
        );
      }
      if (snapshot.version !== command.expectedVersion) {
        throw new Error(
          `Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${snapshot.version}`
        );
      }

      // Schedule variant for drop using the combined command pattern
      const aggregate =
        DigitalDownloadableVariantAggregate.loadFromSnapshot(snapshot);

      // Generate IDs for the schedule
      scheduleId = randomUUIDv7();
      const scheduleGroupId = randomUUIDv7();
      const startScheduleId = randomUUIDv7();

      aggregate.scheduleDrop({
        id: scheduleId,
        scheduleGroupId,
        startScheduleId,
        dropType: command.dropType,
        scheduledFor: command.scheduledFor,
        userId: command.userId,
      });

      // Persist events
      for (const event of aggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      snapshotRepository.saveSnapshot({
        aggregateId: aggregate.id,
        correlationId: command.correlationId,
        version: aggregate.version,
        payload: aggregate.toSnapshot(),
      });

      for (const event of aggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
    return { scheduleId };
  }
}
