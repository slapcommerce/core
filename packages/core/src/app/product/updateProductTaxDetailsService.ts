import type { UnitOfWork } from "../../infrastructure/unitOfWork";
import type { UpdateProductTaxDetailsCommand } from "./commands";
import { ProductAggregate } from "../../domain/product/aggregate";
import { randomUUIDv7 } from "bun";
import type { AccessLevel } from "../accessLevel";
import type { Service } from "../service";

export class UpdateProductTaxDetailsService implements Service<UpdateProductTaxDetailsCommand> {
  accessLevel: AccessLevel = "admin";

  constructor(private unitOfWork: UnitOfWork) {
    this.unitOfWork = unitOfWork;
  }

  async execute(command: UpdateProductTaxDetailsCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } = repositories;
      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error(`Product with id ${command.id} not found`);
      }
      if (snapshot.version !== command.expectedVersion) {
        throw new Error(
          `Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${snapshot.version}`,
        );
      }
      const aggregate = ProductAggregate.loadFromSnapshot(snapshot);
      aggregate.updateProductTaxDetails(
        command.taxable,
        command.taxId,
        command.userId,
      );

      for (const event of aggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      snapshotRepository.saveSnapshot({
        aggregate_id: aggregate.id,
        correlation_id: snapshot.correlation_id,
        version: aggregate.version,
        payload: aggregate.toSnapshot(),
      });

      for (const event of aggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, { id: randomUUIDv7() });
      }
    });
  }
}
