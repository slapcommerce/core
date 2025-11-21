import type { UnitOfWork } from "../../infrastructure/unitOfWork";
import type { ArchiveProductCommand } from "./commands";
import { ProductAggregate } from "../../domain/product/aggregate";
import { randomUUIDv7 } from "bun";
import type { AccessLevel } from "../accessLevel";
import type { Service } from "../service";


export class ArchiveProductService implements Service<ArchiveProductCommand> {
  accessLevel: AccessLevel = "admin";

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
