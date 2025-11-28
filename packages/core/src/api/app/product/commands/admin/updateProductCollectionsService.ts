import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { UpdateProductCollectionsCommand } from "./commands";
import { ProductAggregate } from "../../../../domain/product/aggregate";
import { CollectionAggregate } from "../../../../domain/collection/aggregate";
import { ProductPositionsWithinCollectionAggregate } from "../../../../domain/productPositionsWithinCollection/aggregate";
import { randomUUIDv7 } from "bun";
import type { Service } from "../../../service";

export class UpdateProductCollectionsService implements Service<UpdateProductCollectionsCommand> {

  constructor(
    private unitOfWork: UnitOfWork,

  ) {
    this.unitOfWork = unitOfWork;
  }

  async execute(command: UpdateProductCollectionsCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } =
        repositories;
      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error(`Product with id ${command.id} not found`);
      }
      if (snapshot.version !== command.expectedVersion) {
        throw new Error(
          `Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${snapshot.version}`,
        );
      }
      const productAggregate = ProductAggregate.loadFromSnapshot(snapshot);

      // Get prior collections before updating
      const priorCollections = new Set(productAggregate.toSnapshot().collections);
      const newCollections = new Set(command.collections);

      productAggregate.updateCollections(command.collections, command.userId);

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

      // Collections to add product to
      const collectionsToAdd = command.collections.filter(
        (c) => !priorCollections.has(c),
      );

      // Collections to remove product from
      const collectionsToRemove = [...priorCollections].filter(
        (c) => !newCollections.has(c),
      );

      // Add to new collections' positions aggregates
      for (const collectionId of collectionsToAdd) {
        // Load collection to get the positions aggregate ID
        const collectionSnapshot = snapshotRepository.getSnapshot(collectionId);
        if (!collectionSnapshot) continue;

        const collectionAggregate = CollectionAggregate.loadFromSnapshot(collectionSnapshot);
        const positionsAggregateId = collectionAggregate.productPositionsAggregateId;
        if (!positionsAggregateId) continue;

        const positionsSnapshot = snapshotRepository.getSnapshot(positionsAggregateId);
        if (!positionsSnapshot) continue;

        const positionsAggregate =
          ProductPositionsWithinCollectionAggregate.loadFromSnapshot(positionsSnapshot);
        positionsAggregate.addProduct(command.id, command.userId);

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

      // Remove from old collections' positions aggregates
      for (const collectionId of collectionsToRemove) {
        // Load collection to get the positions aggregate ID
        const collectionSnapshot = snapshotRepository.getSnapshot(collectionId);
        if (!collectionSnapshot) continue;

        const collectionAggregate = CollectionAggregate.loadFromSnapshot(collectionSnapshot);
        const positionsAggregateId = collectionAggregate.productPositionsAggregateId;
        if (!positionsAggregateId) continue;

        const positionsSnapshot = snapshotRepository.getSnapshot(positionsAggregateId);
        if (!positionsSnapshot) continue;

        const positionsAggregate =
          ProductPositionsWithinCollectionAggregate.loadFromSnapshot(positionsSnapshot);
        if (positionsAggregate.getProductPosition(command.id) !== -1) {
          positionsAggregate.removeProduct(command.id, command.userId);

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
