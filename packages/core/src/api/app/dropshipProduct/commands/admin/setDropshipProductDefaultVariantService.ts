import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { SetDropshipProductDefaultVariantCommand } from "./commands";
import { DropshipProductAggregate } from "../../../../domain/dropshipProduct/aggregate";
import { VariantPositionsWithinProductAggregate } from "../../../../domain/variantPositionsWithinProduct/aggregate";
import { randomUUIDv7 } from "bun";

export class SetDropshipProductDefaultVariantService {
  constructor(private unitOfWork: UnitOfWork) {
    this.unitOfWork = unitOfWork;
  }

  async execute(command: SetDropshipProductDefaultVariantCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } =
        repositories;

      const productSnapshot = snapshotRepository.getSnapshot(command.productId);
      if (!productSnapshot) {
        throw new Error(
          `Dropship product with id ${command.productId} not found`
        );
      }
      if (productSnapshot.version !== command.expectedVersion) {
        throw new Error(
          `Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${productSnapshot.version}`
        );
      }

      const productAggregate =
        DropshipProductAggregate.loadFromSnapshot(productSnapshot);

      // Load variant positions aggregate to verify variant belongs to product
      const positionsAggregateId = productAggregate.variantPositionsAggregateId;
      const positionsSnapshot =
        snapshotRepository.getSnapshot(positionsAggregateId);
      if (!positionsSnapshot) {
        throw new Error(
          `Variant positions aggregate ${positionsAggregateId} not found`
        );
      }

      const positionsAggregate =
        VariantPositionsWithinProductAggregate.loadFromSnapshot(
          positionsSnapshot
        );
      const variantIds = positionsAggregate.getVariantIds();

      // Verify the variant belongs to this product
      if (!variantIds.includes(command.variantId)) {
        throw new Error(
          `Variant ${command.variantId} does not belong to product ${command.productId}`
        );
      }

      productAggregate.setDefaultVariant(command.variantId, command.userId);

      for (const event of productAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      snapshotRepository.saveSnapshot({
        aggregateId: productAggregate.id,
        correlationId: productSnapshot.correlationId,
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
