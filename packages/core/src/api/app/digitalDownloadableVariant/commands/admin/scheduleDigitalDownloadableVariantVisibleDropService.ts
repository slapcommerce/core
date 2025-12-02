import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { ScheduleDigitalDownloadableVariantVisibleDropCommand } from "./commands";
import { DigitalDownloadableVariantAggregate } from "../../../../domain/digitalDownloadableVariant/aggregate";
import { ScheduleAggregate } from "../../../../domain/schedule/aggregate";
import { randomUUIDv7 } from "bun";
export class ScheduleDigitalDownloadableVariantVisibleDropService {
  constructor(private unitOfWork: UnitOfWork) {}

  async execute(command: ScheduleDigitalDownloadableVariantVisibleDropCommand) {
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

      // Schedule variant for visible drop
      const variantAggregate =
        DigitalDownloadableVariantAggregate.loadFromSnapshot(snapshot);
      variantAggregate.scheduleVisibleDrop(command.userId);

      // Persist variant events and snapshot
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

      // Create schedule for publishing
      scheduleId = randomUUIDv7();
      const scheduleAggregate = ScheduleAggregate.create({
        id: scheduleId,
        correlationId: command.correlationId,
        userId: command.userId,
        targetAggregateId: command.id,
        targetAggregateType: "digitalDownloadableVariant",
        commandType: "publishDigitalDownloadableVariant",
        commandData: {
          id: command.id,
          type: "publishDigitalDownloadableVariant",
          userId: command.userId,
          expectedVersion: variantAggregate.version,
        },
        scheduledFor: command.scheduledFor,
        createdBy: command.userId,
      });

      // Persist schedule events and snapshot
      for (const event of scheduleAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      snapshotRepository.saveSnapshot({
        aggregateId: scheduleAggregate.id,
        correlationId: command.correlationId,
        version: scheduleAggregate.version,
        payload: scheduleAggregate.toSnapshot(),
      });

      for (const event of scheduleAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
    return { scheduleId };
  }
}
