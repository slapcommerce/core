import type { UnitOfWork } from "../../infrastructure/unitOfWork";
import type { CreateScheduleCommand } from "./commands";
import type { ProjectionService } from "../../infrastructure/projectionService";
import { ScheduleAggregate } from "../../domain/schedule/aggregate";
import { randomUUIDv7 } from "bun";

export class CreateScheduleService {
  constructor(
    private unitOfWork: UnitOfWork,
    private projectionService: ProjectionService
  ) {
    this.unitOfWork = unitOfWork;
    this.projectionService = projectionService;
  }

  async execute(command: CreateScheduleCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } =
        repositories;

      // Create schedule aggregate
      const scheduleAggregate = ScheduleAggregate.create({
        id: command.id,
        correlationId: command.correlationId,
        targetAggregateId: command.targetAggregateId,
        targetAggregateType: command.targetAggregateType,
        commandType: command.commandType,
        commandData: command.commandData,
        scheduledFor: command.scheduledFor,
        createdBy: command.createdBy,
      });

      // Handle schedule events and projections
      for (const event of scheduleAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
        await this.projectionService.handleEvent(event, repositories);
      }

      // Save schedule snapshot
      snapshotRepository.saveSnapshot({
        aggregate_id: scheduleAggregate.id,
        correlation_id: command.correlationId,
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
