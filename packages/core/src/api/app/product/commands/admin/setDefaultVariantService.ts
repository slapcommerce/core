import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { SetDefaultVariantCommand } from "./commands";
import { ProductAggregate } from "../../../../domain/product/aggregate";
import { VariantPositionsWithinProductAggregate } from "../../../../domain/variantPositionsWithinProduct/aggregate";
import { randomUUIDv7 } from "bun";

export class SetDefaultVariantService {
  constructor(private unitOfWork: UnitOfWork) {
    this.unitOfWork = unitOfWork;
  }

  async execute(command: SetDefaultVariantCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } =
        repositories;

      // Load product
      const productSnapshot = snapshotRepository.getSnapshot(command.productId);
      if (!productSnapshot) {
        throw new Error(`Product with id ${command.productId} not found`);
      }

      if (productSnapshot.version !== command.expectedVersion) {
        throw new Error(
          `Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${productSnapshot.version}`,
        );
      }

      const productAggregate = ProductAggregate.loadFromSnapshot(productSnapshot);

      // Load variant positions aggregate to verify variant belongs to product
      const positionsAggregateId = productAggregate.variantPositionsAggregateId;
      const positionsSnapshot = snapshotRepository.getSnapshot(positionsAggregateId);
      if (!positionsSnapshot) {
        throw new Error(`Variant positions aggregate ${positionsAggregateId} not found`);
      }

      const positionsAggregate = VariantPositionsWithinProductAggregate.loadFromSnapshot(positionsSnapshot);
      const variantIds = positionsAggregate.getVariantIds();

      // Verify the variant belongs to this product
      if (!variantIds.includes(command.variantId)) {
        throw new Error(`Variant ${command.variantId} does not belong to product ${command.productId}`);
      }

      // Set the default variant
      productAggregate.setDefaultVariant(command.variantId, command.userId);

      // Save events
      for (const event of productAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Save snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: productAggregate.id,
        correlationId: productSnapshot.correlationId,
        version: productAggregate.version,
        payload: productAggregate.toSnapshot(),
      });

      // Add to outbox
      for (const event of productAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }
}
