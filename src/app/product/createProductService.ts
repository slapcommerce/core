import type { UnitOfWork } from "../../infrastructure/unitOfWork";
import type { CreateProductCommand } from "./commands";
import { ProductAggregate } from "../../domain/product/aggregate";
import { randomUUIDv7 } from "bun";

export class CreateProductService {
  constructor(private unitOfWork: UnitOfWork) {
    this.unitOfWork = unitOfWork;
  }
  async execute(command: CreateProductCommand) {
    return await this.unitOfWork.withTransaction(async ({ eventRepository, snapshotRepository, outboxRepository }) => {
      const productAggregate = ProductAggregate.create(command);
      for (const event of productAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      snapshotRepository.saveSnapshot({
        aggregate_id: productAggregate.id,
        correlation_id: command.correlationId,
        version: productAggregate.version,
        payload: JSON.stringify(productAggregate.toSnapshot()),
      });

      for (const event of productAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }
}