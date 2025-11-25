import { ProductAggregate } from "../../../domain/product/aggregate";
import type { UnitOfWork } from "../../../infrastructure/unitOfWork";
import type { UpdateProductOptionsCommand } from "./commands";
import { randomUUIDv7 } from "bun";
import type { AccessLevel } from "../../accessLevel";
import type { Service } from "../../service";

export class UpdateProductOptionsService implements Service<UpdateProductOptionsCommand> {
  accessLevel: AccessLevel = "admin";

  constructor(
    private unitOfWork: UnitOfWork,

  ) { }

  async execute(command: UpdateProductOptionsCommand): Promise<void> {
    await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } =
        repositories;
      const snapshot = await snapshotRepository.getSnapshot(command.id);

      if (!snapshot) {
        throw new Error(`Product with id ${command.id} not found`);
      }

      if (snapshot.version !== command.expectedVersion) {
        throw new Error(
          `Optimistic concurrency error: expected version ${command.expectedVersion}, but found ${snapshot.version} `,
        );
      }

      const productAggregate = ProductAggregate.loadFromSnapshot(snapshot);
      productAggregate.updateOptions(command.variantOptions, command.userId);

      for (const event of productAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      await snapshotRepository.saveSnapshot({
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
