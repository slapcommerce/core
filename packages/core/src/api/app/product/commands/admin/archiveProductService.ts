import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { ArchiveProductCommand } from "./commands";
import { ProductAggregate } from "../../../../domain/product/aggregate";
import { CollectionAggregate } from "../../../../domain/collection/aggregate";
import { ProductPositionsWithinCollectionAggregate } from "../../../../domain/productPositionsWithinCollection/aggregate";
import { VariantPositionsWithinProductAggregate } from "../../../../domain/variantPositionsWithinProduct/aggregate";
import { randomUUIDv7 } from "bun";
import type { Service } from "../../..//service";


export class ArchiveProductService implements Service<ArchiveProductCommand> {

  constructor(
    private unitOfWork: UnitOfWork
  ) {
    this.unitOfWork = unitOfWork;
  }

  async execute(command: ArchiveProductCommand) {
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
      productAggregate.archive(command.userId);

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

      // Archive the variant positions aggregate
      const variantPositionsAggregateId = productAggregate.variantPositionsAggregateId;
      const variantPositionsSnapshot = snapshotRepository.getSnapshot(variantPositionsAggregateId);
      if (variantPositionsSnapshot) {
        const variantPositionsAggregate = VariantPositionsWithinProductAggregate.loadFromSnapshot(variantPositionsSnapshot);
        variantPositionsAggregate.archive(command.userId);

        // Save variant positions events
        for (const event of variantPositionsAggregate.uncommittedEvents) {
          eventRepository.addEvent(event);
        }

        // Save variant positions snapshot
        snapshotRepository.saveSnapshot({
          aggregateId: variantPositionsAggregateId,
          correlationId: snapshot.correlationId,
          version: variantPositionsAggregate.version,
          payload: variantPositionsAggregate.toSnapshot(),
        });

        // Add variant positions events to outbox
        for (const event of variantPositionsAggregate.uncommittedEvents) {
          outboxRepository.addOutboxEvent(event, {
            id: randomUUIDv7(),
          });
        }
      }

      // Remove product from all collections' positions aggregates
      const productState = productAggregate.toSnapshot();
      for (const collectionId of productState.collections) {
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

        // Only remove if product exists in positions (defensive)
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
