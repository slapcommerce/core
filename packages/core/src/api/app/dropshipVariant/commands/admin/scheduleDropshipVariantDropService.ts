import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { ScheduleDropshipVariantDropCommand } from "./commands";
import { DropshipVariantAggregate } from "../../../../domain/dropshipVariant/aggregate";
import { randomUUIDv7 } from "bun";

export class ScheduleDropshipVariantDropService {
  constructor(private unitOfWork: UnitOfWork) {}

  async execute(command: ScheduleDropshipVariantDropCommand) {
    let scheduleId: string = "";
    await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } =
        repositories;

      // Load and validate variant
      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error(
          `Dropship variant with id ${command.id} not found`
        );
      }
      if (snapshot.version !== command.expectedVersion) {
        throw new Error(
          `Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${snapshot.version}`
        );
      }

      // Schedule variant for drop using the combined command pattern
      const variantAggregate =
        DropshipVariantAggregate.loadFromSnapshot(snapshot);

      // Generate IDs for the schedule
      scheduleId = randomUUIDv7();
      const scheduleGroupId = randomUUIDv7();
      const startScheduleId = randomUUIDv7();

      variantAggregate.scheduleDrop({
        id: scheduleId,
        scheduleGroupId,
        startScheduleId,
        dropType: command.dropType,
        scheduledFor: command.scheduledFor,
        userId: command.userId,
      });

      // Persist variant events and snapshot
      for (const event of variantAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      snapshotRepository.saveSnapshot({
        aggregateId: variantAggregate.id,
        correlationId: command.correlationId,
        version: variantAggregate.version,
        payload: variantAggregate.toSnapshot(),
      });

      for (const event of variantAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
    return { scheduleId };
  }
}
