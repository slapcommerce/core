import type { UnitOfWork } from "../../infrastructure/unitOfWork";
import type { CancelScheduleCommand } from "./commands";
import type { ProjectionService } from "../../infrastructure/projectionService";
import { ScheduleAggregate } from "../../domain/schedule/aggregate";
import { randomUUIDv7 } from "bun";

export class CancelScheduleService {
  constructor(
    private unitOfWork: UnitOfWork,
    private projectionService: ProjectionService
  ) {
    this.unitOfWork = unitOfWork;
    this.projectionService = projectionService;
  }

  async execute(command: CancelScheduleCommand) {
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

      // Cancel schedule
      scheduleAggregate.cancel(command.userId);

      // Handle schedule events and projections
      for (const event of scheduleAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
        await this.projectionService.handleEvent(event, repositories);
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
