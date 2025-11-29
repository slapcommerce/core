import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { UpdateBundleMetadataCommand } from "./commands";
import { BundleAggregate } from "../../../../domain/bundle/aggregate";
import { randomUUIDv7 } from "bun";
import type { Service } from "../../../service";

export class UpdateBundleMetadataService implements Service<UpdateBundleMetadataCommand> {
  constructor(private unitOfWork: UnitOfWork) {
    this.unitOfWork = unitOfWork;
  }

  async execute(command: UpdateBundleMetadataCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } = repositories;

      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error(`Bundle with id ${command.id} not found`);
      }
      if (snapshot.version !== command.expectedVersion) {
        throw new Error(
          `Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${snapshot.version}`,
        );
      }

      const bundleAggregate = BundleAggregate.loadFromSnapshot(snapshot);
      bundleAggregate.updateMetadata(
        command.metaTitle,
        command.metaDescription,
        command.tags,
        command.userId,
      );

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
