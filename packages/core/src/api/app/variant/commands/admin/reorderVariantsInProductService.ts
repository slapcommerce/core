import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { ReorderVariantsInProductCommand } from "./commands";
import { ProductAggregate } from "../../../../domain/product/aggregate";
import { VariantPositionsWithinProductAggregate } from "../../../../domain/variantPositionsWithinProduct/aggregate";
import { randomUUIDv7 } from "bun";

export class ReorderVariantsInProductService {
  constructor(private unitOfWork: UnitOfWork) {
    this.unitOfWork = unitOfWork;
  }

  async execute(command: ReorderVariantsInProductCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } =
        repositories;

      // Load product to get the variant positions aggregate ID
      const productSnapshot = snapshotRepository.getSnapshot(command.productId);
      if (!productSnapshot) {
        throw new Error(`Product with id ${command.productId} not found`);
      }

      const productAggregate = ProductAggregate.loadFromSnapshot(productSnapshot);
      const positionsAggregateId = productAggregate.variantPositionsAggregateId;

      if (!positionsAggregateId) {
        throw new Error(`Product ${command.productId} has no variant positions aggregate`);
      }

      // Load the VariantPositionsWithinProduct aggregate
      const existingSnapshot = snapshotRepository.getSnapshot(positionsAggregateId);
      if (!existingSnapshot) {
        throw new Error(`Variant positions aggregate ${positionsAggregateId} not found`);
      }

      const positionsAggregate =
        VariantPositionsWithinProductAggregate.loadFromSnapshot(existingSnapshot);

      // Build the new order array from the command's position updates
      // Sort by position to get the correct order
      const sortedPositions = [...command.variantPositions].sort(
        (a, b) => a.position - b.position,
      );
      const newOrder = sortedPositions.map((p) => p.variantId);

      // Reorder the variants (single event, O(1) operation)
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
