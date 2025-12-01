import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { UpdateDropshipVariantSkuCommand } from "./commands";
import { DropshipVariantAggregate } from "../../../../domain/dropshipVariant/aggregate";
import { SkuAggregate } from "../../../../domain/sku/skuAggregate";
import { randomUUIDv7 } from "bun";
import type { Service } from "../../../service";

export class UpdateDropshipVariantSkuService implements Service<UpdateDropshipVariantSkuCommand> {

  constructor(private unitOfWork: UnitOfWork) {}

  async execute(command: UpdateDropshipVariantSkuCommand) {
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
      const oldSku = variantAggregate.toSnapshot().sku;

      // Release old SKU if exists
      let oldSkuAggregate: SkuAggregate | null = null;
      if (oldSku && oldSku.trim() !== "") {
        const oldSkuSnapshot = snapshotRepository.getSnapshot(oldSku);
        if (oldSkuSnapshot) {
          oldSkuAggregate = SkuAggregate.loadFromSnapshot(oldSkuSnapshot);
          oldSkuAggregate.releaseSku(command.userId);
        }
      }

      // Reserve new SKU
      const newSkuSnapshot = snapshotRepository.getSnapshot(command.sku);
      let newSkuAggregate: SkuAggregate;
      if (!newSkuSnapshot) {
        newSkuAggregate = SkuAggregate.create({
          sku: command.sku,
          correlationId: snapshot.correlationId,
        });
      } else {
        newSkuAggregate = SkuAggregate.loadFromSnapshot(newSkuSnapshot);
      }

      if (!newSkuAggregate.isSkuAvailable()) {
        throw new Error(`SKU "${command.sku}" is already in use`);
      }

      newSkuAggregate.reserveSku(command.id, command.userId);
      variantAggregate.updateSku(command.sku, command.userId);

      // Add variant events
      for (const event of variantAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Add old SKU events
      if (oldSkuAggregate) {
        for (const event of oldSkuAggregate.uncommittedEvents) {
          eventRepository.addEvent(event);
        }
      }

      // Add new SKU events
      for (const event of newSkuAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Save variant snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: variantAggregate.id,
        correlationId: snapshot.correlationId,
        version: variantAggregate.version,
        payload: variantAggregate.toSnapshot(),
      });

      // Save old SKU snapshot
      if (oldSkuAggregate) {
        snapshotRepository.saveSnapshot({
          aggregateId: oldSkuAggregate.id,
          correlationId: snapshot.correlationId,
          version: oldSkuAggregate.version,
          payload: oldSkuAggregate.toSnapshot(),
        });
      }

      // Save new SKU snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: newSkuAggregate.id,
        correlationId: snapshot.correlationId,
        version: newSkuAggregate.version,
        payload: newSkuAggregate.toSnapshot(),
      });

      // Add to outbox
      for (const event of variantAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
      if (oldSkuAggregate) {
        for (const event of oldSkuAggregate.uncommittedEvents) {
          outboxRepository.addOutboxEvent(event, {
            id: randomUUIDv7(),
          });
        }
      }
      for (const event of newSkuAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }
}
