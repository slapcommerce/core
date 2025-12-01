import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { ArchiveDropshipVariantCommand } from "./commands";
import { DropshipVariantAggregate } from "../../../../domain/dropshipVariant/aggregate";
import { SkuAggregate } from "../../../../domain/sku/skuAggregate";
import { DropshipProductAggregate } from "../../../../domain/dropshipProduct/aggregate";
import { VariantPositionsWithinProductAggregate } from "../../../../domain/variantPositionsWithinProduct/aggregate";
import { randomUUIDv7 } from "bun";
import type { Service } from "../../../service";

export class ArchiveDropshipVariantService implements Service<ArchiveDropshipVariantCommand> {

  constructor(private unitOfWork: UnitOfWork) {}

  async execute(command: ArchiveDropshipVariantCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } = repositories;

      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error(`Dropship variant with id ${command.id} not found`);
      }
      if (snapshot.version !== command.expectedVersion) {
        throw new Error(`Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${snapshot.version}`);
      }

      const variantAggregate = DropshipVariantAggregate.loadFromSnapshot(snapshot);
      const variantSnapshotData = variantAggregate.toSnapshot();

      // Archive variant
      variantAggregate.archive(command.userId);

      // Load SKU aggregate to release it if exists
      let skuAggregate: SkuAggregate | null = null;
      if (variantSnapshotData.sku && variantSnapshotData.sku.trim() !== "") {
        const skuSnapshot = snapshotRepository.getSnapshot(variantSnapshotData.sku);
        if (skuSnapshot) {
          skuAggregate = SkuAggregate.loadFromSnapshot(skuSnapshot);
          skuAggregate.releaseSku(command.userId);
        }
      }

      // Load product to get variant positions aggregate and check default variant
      const productSnapshot = snapshotRepository.getSnapshot(variantSnapshotData.productId);
      if (!productSnapshot) {
        throw new Error(`Dropship product ${variantSnapshotData.productId} not found`);
      }
      const productAggregate = DropshipProductAggregate.loadFromSnapshot(productSnapshot);

      // Load variant positions aggregate and remove this variant
      const variantPositionsAggregateId = productAggregate.variantPositionsAggregateId;
      const variantPositionsSnapshot = snapshotRepository.getSnapshot(variantPositionsAggregateId);
      if (!variantPositionsSnapshot) {
        throw new Error(`Variant positions aggregate ${variantPositionsAggregateId} not found`);
      }
      const variantPositionsAggregate = VariantPositionsWithinProductAggregate.loadFromSnapshot(variantPositionsSnapshot);
      variantPositionsAggregate.removeVariant(command.id, command.userId);

      // If this was the default variant, clear it
      if (productAggregate.defaultVariantId === command.id) {
        productAggregate.clearDefaultVariant(command.userId);
      }

      // Handle variant events
      for (const event of variantAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Handle SKU aggregate events
      if (skuAggregate) {
        for (const event of skuAggregate.uncommittedEvents) {
          eventRepository.addEvent(event);
        }
      }

      // Handle variant positions aggregate events
      for (const event of variantPositionsAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Handle product aggregate events (if default variant was cleared)
      for (const event of productAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Save variant snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: variantAggregate.id,
        correlationId: snapshot.correlationId,
        version: variantAggregate.version,
        payload: variantAggregate.toSnapshot(),
      });

      // Save SKU aggregate snapshot
      if (skuAggregate) {
        snapshotRepository.saveSnapshot({
          aggregateId: skuAggregate.id,
          correlationId: snapshot.correlationId,
          version: skuAggregate.version,
          payload: skuAggregate.toSnapshot(),
        });
      }

      // Save variant positions aggregate snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: variantPositionsAggregateId,
        correlationId: snapshot.correlationId,
        version: variantPositionsAggregate.version,
        payload: variantPositionsAggregate.toSnapshot(),
      });

      // Save product aggregate snapshot (if default variant was cleared)
      if (productAggregate.uncommittedEvents.length > 0) {
        snapshotRepository.saveSnapshot({
          aggregateId: productAggregate.id,
          correlationId: snapshot.correlationId,
          version: productAggregate.version,
          payload: productAggregate.toSnapshot(),
        });
      }

      // Add all events to outbox
      for (const event of variantAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
      if (skuAggregate) {
        for (const event of skuAggregate.uncommittedEvents) {
          outboxRepository.addOutboxEvent(event, {
            id: randomUUIDv7(),
          });
        }
      }
      for (const event of variantPositionsAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
      for (const event of productAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }
}
