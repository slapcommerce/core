import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { CancelScheduledDropshipProductDropCommand } from "./commands";
import { DropshipProductAggregate } from "../../../../domain/dropshipProduct/aggregate";
import { randomUUIDv7 } from "bun";

export class CancelScheduledDropshipProductDropService {
  constructor(private unitOfWork: UnitOfWork) {}

  async execute(command: CancelScheduledDropshipProductDropCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } = repositories;

      // Load and validate product
      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error(`Dropship product with id ${command.id} not found`);
      }
      if (snapshot.version !== command.expectedVersion) {
        throw new Error(
          `Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${snapshot.version}`
        );
      }

      const aggregate = DropshipProductAggregate.loadFromSnapshot(snapshot);

      // Cancel the scheduled drop on the product
      aggregate.cancelScheduledDrop(command.userId);

      // Persist events
      for (const event of aggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Save snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: aggregate.id,
        correlationId: randomUUIDv7(),
        version: aggregate.version,
        payload: aggregate.toSnapshot(),
      });

      // Add to outbox
      for (const event of aggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }
}
