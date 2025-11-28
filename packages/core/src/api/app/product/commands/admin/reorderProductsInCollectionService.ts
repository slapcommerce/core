import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { ReorderProductsInCollectionCommand } from "./commands";
import { ProductAggregate } from "../../../../domain/product/aggregate";
import { randomUUIDv7 } from "bun";

export class ReorderProductsInCollectionService {
  constructor(private unitOfWork: UnitOfWork) {
    this.unitOfWork = unitOfWork;
  }

  async execute(command: ReorderProductsInCollectionCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } =
        repositories;

      // Process each product position update
      for (const { productId, position } of command.productPositions) {
        const snapshot = snapshotRepository.getSnapshot(productId);
        if (!snapshot) {
          throw new Error(`Product with id ${productId} not found`);
        }

        const productAggregate = ProductAggregate.loadFromSnapshot(snapshot);

        // Update the position for this collection
        productAggregate.updateCollectionPositions(
          command.collectionId,
          position,
          command.userId,
        );

        // Save events
        for (const event of productAggregate.uncommittedEvents) {
          eventRepository.addEvent(event);
        }

        // Save snapshot
        snapshotRepository.saveSnapshot({
          aggregateId: productAggregate.id,
          correlationId: snapshot.correlationId,
          version: productAggregate.version,
          payload: productAggregate.toSnapshot(),
        });

        // Add to outbox
        for (const event of productAggregate.uncommittedEvents) {
          outboxRepository.addOutboxEvent(event, {
            id: randomUUIDv7(),
          });
        }
      }
    });
  }
}
