import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { UpdateDigitalDownloadableProductCollectionsCommand } from "./commands";
import { DigitalDownloadableProductAggregate } from "../../../../domain/digitalDownloadableProduct/aggregate";
import { CollectionAggregate } from "../../../../domain/collection/aggregate";
import { ProductPositionsWithinCollectionAggregate } from "../../../../domain/productPositionsWithinCollection/aggregate";
import { randomUUIDv7 } from "bun";
import type { Service } from "../../../service";

export class UpdateDigitalDownloadableProductCollectionsService
  implements Service<UpdateDigitalDownloadableProductCollectionsCommand>
{
  constructor(private unitOfWork: UnitOfWork) {
    this.unitOfWork = unitOfWork;
  }

  async execute(command: UpdateDigitalDownloadableProductCollectionsCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } =
        repositories;

      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error(
          `Digital downloadable product with id ${command.id} not found`
        );
      }
      if (snapshot.version !== command.expectedVersion) {
        throw new Error(
          `Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${snapshot.version}`
        );
      }

      const productAggregate =
        DigitalDownloadableProductAggregate.loadFromSnapshot(snapshot);
      const productSnapshot = productAggregate.toSnapshot();
      const oldCollections = productSnapshot.collections;
      const newCollections = command.collections;

      productAggregate.updateCollections(newCollections, command.userId);

      // Find collections to add and remove
      const collectionsToRemove = oldCollections.filter(
        (id) => !newCollections.includes(id)
      );
      const collectionsToAdd = newCollections.filter(
        (id) => !oldCollections.includes(id)
      );

      // Remove product from old collections
      for (const collectionId of collectionsToRemove) {
        const collectionSnapshot = snapshotRepository.getSnapshot(collectionId);
        if (!collectionSnapshot) continue;

        const collectionAggregate =
          CollectionAggregate.loadFromSnapshot(collectionSnapshot);
        const positionsAggregateId =
          collectionAggregate.productPositionsAggregateId;
        if (!positionsAggregateId) continue;

        const positionsSnapshot =
          snapshotRepository.getSnapshot(positionsAggregateId);
        if (!positionsSnapshot) continue;

        const positionsAggregate =
          ProductPositionsWithinCollectionAggregate.loadFromSnapshot(
            positionsSnapshot
          );
        positionsAggregate.removeProduct(command.id, command.userId);

        for (const event of positionsAggregate.uncommittedEvents) {
          eventRepository.addEvent(event);
        }

        snapshotRepository.saveSnapshot({
          aggregateId: positionsAggregateId,
          correlationId: snapshot.correlationId,
          version: positionsAggregate.version,
          payload: positionsAggregate.toSnapshot(),
        });

        for (const event of positionsAggregate.uncommittedEvents) {
          outboxRepository.addOutboxEvent(event, {
            id: randomUUIDv7(),
          });
        }
      }

      // Add product to new collections
      for (const collectionId of collectionsToAdd) {
        const collectionSnapshot = snapshotRepository.getSnapshot(collectionId);
        if (!collectionSnapshot) continue;

        const collectionAggregate =
          CollectionAggregate.loadFromSnapshot(collectionSnapshot);
        const positionsAggregateId =
          collectionAggregate.productPositionsAggregateId;
        if (!positionsAggregateId) continue;

        const positionsSnapshot =
          snapshotRepository.getSnapshot(positionsAggregateId);
        if (!positionsSnapshot) continue;

        const positionsAggregate =
          ProductPositionsWithinCollectionAggregate.loadFromSnapshot(
            positionsSnapshot
          );
        positionsAggregate.addProduct(command.id, command.userId);

        for (const event of positionsAggregate.uncommittedEvents) {
          eventRepository.addEvent(event);
        }

        snapshotRepository.saveSnapshot({
          aggregateId: positionsAggregateId,
          correlationId: snapshot.correlationId,
          version: positionsAggregate.version,
          payload: positionsAggregate.toSnapshot(),
        });

        for (const event of positionsAggregate.uncommittedEvents) {
          outboxRepository.addOutboxEvent(event, {
            id: randomUUIDv7(),
          });
        }
      }

      // Save product events
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
    });
  }
}
