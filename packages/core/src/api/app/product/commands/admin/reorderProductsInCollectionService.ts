import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { ReorderProductsInCollectionCommand } from "./commands";
import { CollectionAggregate } from "../../../../domain/collection/aggregate";
import { ProductPositionsWithinCollectionAggregate } from "../../../../domain/productPositionsWithinCollection/aggregate";
import { randomUUIDv7 } from "bun";

export class ReorderProductsInCollectionService {
  constructor(private unitOfWork: UnitOfWork) {
    this.unitOfWork = unitOfWork;
  }

  async execute(command: ReorderProductsInCollectionCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } =
        repositories;

      // Load collection to get the positions aggregate ID
      const collectionSnapshot = snapshotRepository.getSnapshot(command.collectionId);
      if (!collectionSnapshot) {
        throw new Error(`Collection with id ${command.collectionId} not found`);
      }

      const collectionAggregate = CollectionAggregate.loadFromSnapshot(collectionSnapshot);
      const positionsAggregateId = collectionAggregate.productPositionsAggregateId;

      if (!positionsAggregateId) {
        throw new Error(`Collection ${command.collectionId} has no positions aggregate`);
      }

      // Load or create the ProductPositionsWithinCollection aggregate
      let positionsAggregate: ProductPositionsWithinCollectionAggregate;

      const existingSnapshot = snapshotRepository.getSnapshot(positionsAggregateId);
      if (existingSnapshot) {
        positionsAggregate =
          ProductPositionsWithinCollectionAggregate.loadFromSnapshot(existingSnapshot);
      } else {
        // Create new positions aggregate with existing products
        const existingProductIds = command.productPositions.map(
          (p) => p.productId,
        );
        positionsAggregate = ProductPositionsWithinCollectionAggregate.create({
          id: positionsAggregateId,
          collectionId: command.collectionId,
          correlationId: randomUUIDv7(),
          userId: command.userId,
          productIds: existingProductIds,
        });
      }

      // Build the new order array from the command's position updates
      // Sort by position to get the correct order
      const sortedPositions = [...command.productPositions].sort(
        (a, b) => a.position - b.position,
      );
      const newOrder = sortedPositions.map((p) => p.productId);

      // Reorder the products (single event, O(1) operation)
      positionsAggregate.reorder(newOrder, command.userId);

      // Save events
      for (const event of positionsAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Save snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: positionsAggregateId,
        correlationId: positionsAggregate.correlationId,
        version: positionsAggregate.version,
        payload: positionsAggregate.toSnapshot(),
      });

      // Add to outbox
      for (const event of positionsAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }
}
