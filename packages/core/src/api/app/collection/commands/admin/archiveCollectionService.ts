import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { ArchiveCollectionCommand } from "./commands";
import { CollectionAggregate } from "../../../../domain/collection/aggregate";
import { ProductPositionsWithinCollectionAggregate } from "../../../../domain/productPositionsWithinCollection/aggregate";
import { randomUUIDv7 } from "bun";


export class ArchiveCollectionService {

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
        aggregateId: collectionAggregate.id,
        correlationId: snapshot.correlationId,
        version: collectionAggregate.version,
        payload: collectionAggregate.toSnapshot(),
      });

      for (const event of collectionAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }

      // Archive the positions aggregate using ID stored on collection
      const positionsAggregateId = collectionAggregate.productPositionsAggregateId;
      if (positionsAggregateId) {
        const positionsSnapshot = snapshotRepository.getSnapshot(positionsAggregateId);

        if (positionsSnapshot) {
          const positionsAggregate =
            ProductPositionsWithinCollectionAggregate.loadFromSnapshot(positionsSnapshot);
          positionsAggregate.archive(command.userId);

          // Save positions events
          for (const event of positionsAggregate.uncommittedEvents) {
            eventRepository.addEvent(event);
          }

          // Save positions snapshot
          snapshotRepository.saveSnapshot({
            aggregateId: positionsAggregateId,
            correlationId: snapshot.correlationId,
            version: positionsAggregate.version,
            payload: positionsAggregate.toSnapshot(),
          });

          // Add positions events to outbox
          for (const event of positionsAggregate.uncommittedEvents) {
            outboxRepository.addOutboxEvent(event, {
              id: randomUUIDv7(),
            });
          }
        }
      }
    });
  }
}
