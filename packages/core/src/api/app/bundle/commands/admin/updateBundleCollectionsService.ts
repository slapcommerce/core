import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { UpdateBundleCollectionsCommand } from "./commands";
import { BundleAggregate } from "../../../../domain/bundle/aggregate";
import { CollectionAggregate } from "../../../../domain/collection/aggregate";
import { ProductPositionsWithinCollectionAggregate } from "../../../../domain/productPositionsWithinCollection/aggregate";
import { randomUUIDv7 } from "bun";
import type { Service } from "../../../service";

export class UpdateBundleCollectionsService implements Service<UpdateBundleCollectionsCommand> {
  constructor(private unitOfWork: UnitOfWork) {
    this.unitOfWork = unitOfWork;
  }

  async execute(command: UpdateBundleCollectionsCommand) {
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

      // Get prior collections before updating
      const priorCollections = new Set(bundleAggregate.collections);
      const newCollections = new Set(command.collections);

      bundleAggregate.updateCollections(command.collections, command.userId);

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

      // Collections to add bundle to
      const collectionsToAdd = command.collections.filter(
        (c) => !priorCollections.has(c),
      );

      // Collections to remove bundle from
      const collectionsToRemove = [...priorCollections].filter(
        (c) => !newCollections.has(c),
      );

      // Add to new collections' positions aggregates (bundles share positions with products)
      for (const collectionId of collectionsToAdd) {
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

      // Remove from old collections' positions aggregates
      for (const collectionId of collectionsToRemove) {
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
      }
    });
  }
}
