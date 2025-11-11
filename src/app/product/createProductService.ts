import type { UnitOfWork } from "../../infrastructure/unitOfWork";
import type { CreateProductCommand } from "./commands";
import type { ProjectionService } from "../../infrastructure/projectionService";
import { ProductAggregate } from "../../domain/product/aggregate";
import { randomUUIDv7 } from "bun";

export class CreateProductService {
  constructor(
    private unitOfWork: UnitOfWork,
    private projectionService: ProjectionService
  ) {
    this.unitOfWork = unitOfWork;
    this.projectionService = projectionService;
  }
  async execute(command: CreateProductCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } = repositories;
      const productAggregate = ProductAggregate.create(command);
      for (const event of productAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
        await this.projectionService.handleEvent(event, repositories);
      }

      snapshotRepository.saveSnapshot({
        aggregate_id: productAggregate.id,
        correlation_id: command.correlationId,
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