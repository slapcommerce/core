import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { RemoveBundleImageCommand } from "./commands";
import { BundleAggregate } from "../../../../domain/bundle/aggregate";
import { randomUUIDv7 } from "bun";
import type { Service } from "../../../service";

export class RemoveBundleImageService implements Service<RemoveBundleImageCommand> {
  constructor(private unitOfWork: UnitOfWork) {
    this.unitOfWork = unitOfWork;
  }

  async execute(command: RemoveBundleImageCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } = repositories;

      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error(`Bundle with id ${command.id} not found`);
      }

      if (snapshot.version !== command.expectedVersion) {
        throw new Error(
          `Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${snapshot.version}`
        );
      }

      const bundleAggregate = BundleAggregate.loadFromSnapshot(snapshot);
      bundleAggregate.removeImage(command.imageId, command.userId);

      for (const event of bundleAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      snapshotRepository.saveSnapshot({
        aggregateId: bundleAggregate.id,
        correlationId: snapshot.correlationId,
        version: bundleAggregate.version,
        payload: bundleAggregate.toSnapshot(),
      });

      for (const event of bundleAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }
}
