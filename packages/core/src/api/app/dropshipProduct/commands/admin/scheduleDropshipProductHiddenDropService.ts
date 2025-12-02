import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { ScheduleDropshipProductHiddenDropCommand } from "./commands";
import { DropshipProductAggregate } from "../../../../domain/dropshipProduct/aggregate";
import { ScheduleAggregate } from "../../../../domain/schedule/aggregate";
import { randomUUIDv7 } from "bun";
export class ScheduleDropshipProductHiddenDropService {
  constructor(private unitOfWork: UnitOfWork) {
    this.unitOfWork = unitOfWork;
  }

  async execute(command: ScheduleDropshipProductHiddenDropCommand) {
    let scheduleId: string = "";
    await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } =
        repositories;

      // Load and validate product
      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error(
          `Dropship product with id ${command.id} not found`
        );
      }
      if (snapshot.version !== command.expectedVersion) {
        throw new Error(
          `Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${snapshot.version}`
        );
      }

      // Set product to hidden pending drop status
      const productAggregate =
        DropshipProductAggregate.loadFromSnapshot(snapshot);
      productAggregate.scheduleHiddenDrop(command.userId);

      // Persist product events and snapshot
      for (const event of productAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      snapshotRepository.saveSnapshot({
        aggregateId: productAggregate.id,
        correlationId: snapshot.correlationId,
        version: productAggregate.version,
        payload: productAggregate.toSnapshot(),
      });

      for (const event of productAggregate.uncommittedEvents) {
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
        targetAggregateType: "dropshipProduct",
        commandType: "publishDropshipProduct",
        commandData: {
          id: command.id,
          type: "publishDropshipProduct",
          userId: command.userId,
          expectedVersion: productAggregate.version,
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
