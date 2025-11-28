import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { UpdateProductDetailsCommand } from "./commands";
import { ProductAggregate } from "../../../../domain/product/aggregate";
import { randomUUIDv7 } from "bun";
import type { Service } from "../../../service";

export class UpdateProductDetailsService implements Service<UpdateProductDetailsCommand> {

  constructor(
    private unitOfWork: UnitOfWork,

  ) {
    this.unitOfWork = unitOfWork;
  }

  async execute(command: UpdateProductDetailsCommand) {
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
      productAggregate.updateDetails(
        command.name,
        command.description,
        command.richDescriptionUrl,
        command.userId,
      );

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
    });
  }
}
