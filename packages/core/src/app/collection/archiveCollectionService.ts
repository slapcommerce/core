import type { UnitOfWork } from "../../infrastructure/unitOfWork";
import type { ArchiveCollectionCommand } from "./commands";
import { CollectionAggregate } from "../../domain/collection/aggregate";
import { randomUUIDv7 } from "bun";
import type { AccessLevel } from "../accessLevel";


export class ArchiveCollectionService {
  accessLevel: AccessLevel = "admin";

  constructor(
    private unitOfWork: UnitOfWork,

  ) {
    this.unitOfWork = unitOfWork;
  }

  async execute(command: ArchiveCollectionCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } = repositories;
      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error(`Collection with id ${command.id} not found`);
      }
      if (snapshot.version !== command.expectedVersion) {
        throw new Error(`Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${snapshot.version}`);
      }
      const collectionAggregate = CollectionAggregate.loadFromSnapshot(snapshot);
      collectionAggregate.archive(command.userId);

      for (const event of collectionAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      snapshotRepository.saveSnapshot({
        aggregate_id: collectionAggregate.id,
        correlation_id: snapshot.correlation_id,
        version: collectionAggregate.version,
        payload: collectionAggregate.toSnapshot(),
      });

      for (const event of collectionAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }
}
