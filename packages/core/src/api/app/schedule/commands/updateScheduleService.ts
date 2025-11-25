import type { UnitOfWork } from "../../../infrastructure/unitOfWork";
import type { UpdateScheduleCommand } from "./commands";
import { ScheduleAggregate } from "../../../domain/schedule/aggregate";
import { randomUUIDv7 } from "bun";
import type { AccessLevel } from "../../accessLevel";
import type { Service } from "../../service";

export class UpdateScheduleService implements Service<UpdateScheduleCommand> {
  accessLevel: AccessLevel = "admin";

  constructor(
    private unitOfWork: UnitOfWork,

  ) {
    this.unitOfWork = unitOfWork;
  }

  async execute(command: UpdateScheduleCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } =
        repositories;

      // Load schedule aggregate
      const scheduleSnapshot = snapshotRepository.getSnapshot(command.id);
      if (!scheduleSnapshot) {
        throw new Error(`Schedule with id ${command.id} not found`);
      }
      if (scheduleSnapshot.version !== command.expectedVersion) {
        throw new Error(
          `Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${scheduleSnapshot.version}`
        );
      }
      const scheduleAggregate =
        ScheduleAggregate.loadFromSnapshot(scheduleSnapshot);

      // Update schedule
      scheduleAggregate.update(command.scheduledFor, command.commandData, command.userId);

      // Handle schedule events and projections
      for (const event of scheduleAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Save schedule snapshot
      snapshotRepository.saveSnapshot({
        aggregate_id: scheduleAggregate.id,
        correlation_id: scheduleSnapshot.correlation_id,
        version: scheduleAggregate.version,
        payload: scheduleAggregate.toSnapshot(),
      });

      // Add all events to outbox
      for (const event of scheduleAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }
}
