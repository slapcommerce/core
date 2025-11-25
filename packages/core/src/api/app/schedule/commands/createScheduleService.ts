import type { UnitOfWork } from "../../../infrastructure/unitOfWork";
import type { CreateScheduleCommand } from "./commands";
import { ScheduleAggregate } from "../../../domain/schedule/aggregate";
import { randomUUIDv7 } from "bun";
import type { AccessLevel } from "../../accessLevel";
import type { Service } from "../../service";

export class CreateScheduleService implements Service<CreateScheduleCommand> {
  accessLevel: AccessLevel = "admin";

  constructor(
    private unitOfWork: UnitOfWork,

  ) {
    this.unitOfWork = unitOfWork;
  }

  async execute(command: CreateScheduleCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } =
        repositories;

      // Create schedule aggregate
      const scheduleAggregate = ScheduleAggregate.create({
        id: command.id,
        correlationId: command.correlationId,
        userId: command.userId,
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
