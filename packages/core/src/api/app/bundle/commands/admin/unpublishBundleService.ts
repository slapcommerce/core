import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { UnpublishBundleCommand } from "./commands";
import { BundleAggregate } from "../../../../domain/bundle/aggregate";
import { randomUUIDv7 } from "bun";
import type { Service } from "../../../service";

export class UnpublishBundleService implements Service<UnpublishBundleCommand> {
  constructor(private unitOfWork: UnitOfWork) {
    this.unitOfWork = unitOfWork;
  }

  async execute(command: UnpublishBundleCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } = repositories;

      // Load aggregate from snapshot
      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error("Bundle not found");
      }

      const bundleAggregate = BundleAggregate.loadFromSnapshot(snapshot);

      // Check version
      if (bundleAggregate.version !== command.expectedVersion) {
        throw new Error("Version mismatch");
      }

      // Unpublish the aggregate
      bundleAggregate.unpublish(command.userId);

      // Handle events
      for (const event of bundleAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Save snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: bundleAggregate.id,
        correlationId: snapshot.correlationId,
        version: bundleAggregate.version,
        payload: bundleAggregate.toSnapshot(),
      });

      // Add events to outbox
      for (const event of bundleAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }
}
