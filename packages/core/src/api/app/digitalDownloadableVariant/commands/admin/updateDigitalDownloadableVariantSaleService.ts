import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { UpdateDigitalDownloadableVariantSaleCommand } from "./commands";
import { DigitalDownloadableVariantAggregate } from "../../../../domain/digitalDownloadableVariant/aggregate";
import { randomUUIDv7 } from "bun";
import type { Service } from "../../../service";

export class UpdateDigitalDownloadableVariantSaleService implements Service<UpdateDigitalDownloadableVariantSaleCommand> {

  constructor(private unitOfWork: UnitOfWork) {}

  async execute(command: UpdateDigitalDownloadableVariantSaleCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } = repositories;

      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error(`Digital downloadable variant with id ${command.id} not found`);
      }
      if (command.expectedVersion !== undefined && snapshot.version !== command.expectedVersion) {
        throw new Error(`Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${snapshot.version}`);
      }

      const variantAggregate = DigitalDownloadableVariantAggregate.loadFromSnapshot(snapshot);
      variantAggregate.updateSale(command.saleType, command.saleValue, command.userId);

      for (const event of variantAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      snapshotRepository.saveSnapshot({
        aggregateId: variantAggregate.id,
        correlationId: snapshot.correlationId,
        version: variantAggregate.version,
        payload: variantAggregate.toSnapshot(),
      });

      for (const event of variantAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }
}
