import type { UnitOfWork } from "../../infrastructure/unitOfWork";
import type { PublishProductCommand } from "./commands";
import type { ProjectionService } from "../../infrastructure/projectionService";
import { ProductAggregate } from "../../domain/product/aggregate";
import { randomUUIDv7 } from "bun";

export class PublishProductService {
  constructor(
    private unitOfWork: UnitOfWork,
    private projectionService: ProjectionService,
  ) {
    this.unitOfWork = unitOfWork;
    this.projectionService = projectionService;
  }

  async execute(command: PublishProductCommand) {
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
      productAggregate.publish(command.userId);

      for (const event of productAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
        await this.projectionService.handleEvent(event, repositories);
      }

      snapshotRepository.saveSnapshot({
        aggregate_id: productAggregate.id,
        correlation_id: snapshot.correlation_id,
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
