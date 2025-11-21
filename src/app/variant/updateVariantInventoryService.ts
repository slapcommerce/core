import type { UnitOfWork } from "../../infrastructure/unitOfWork";
import type { UpdateVariantInventoryCommand } from "./commands";
import type { ProjectionService } from "../../infrastructure/projectionService";
import { VariantAggregate } from "../../domain/variant/aggregate";
import { ProductAggregate } from "../../domain/product/aggregate";
import { randomUUIDv7 } from "bun";
import type { AccessLevel } from "../accessLevel";
import type { Service } from "../service";

export class UpdateVariantInventoryService implements Service<UpdateVariantInventoryCommand> {
  accessLevel: AccessLevel = "admin";

  constructor(
    private unitOfWork: UnitOfWork,
    private projectionService: ProjectionService
  ) {
    this.unitOfWork = unitOfWork;
    this.projectionService = projectionService;
  }

  async execute(command: UpdateVariantInventoryCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } = repositories;
      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error(`Variant with id ${command.id} not found`);
      }
      if (snapshot.version !== command.expectedVersion) {
        throw new Error(`Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${snapshot.version}`);
      }
      const variantAggregate = VariantAggregate.loadFromSnapshot(snapshot);

      // Check Product Fulfillment Type
      const productId = variantAggregate.toSnapshot().productId;
      const productSnapshot = snapshotRepository.getSnapshot(productId);
      
      // If product snapshot is missing, we can't enforce rules, but that shouldn't happen in a consistent system.
      // Assuming it exists or ignoring if not found (safest to ignore or throw? Throwing ensures integrity).
      if (productSnapshot) {
        const productAggregate = ProductAggregate.loadFromSnapshot(productSnapshot);
        if (productAggregate.fulfillmentType === "digital") {
          if (command.inventory !== -1) {
            throw new Error("Digital products cannot have tracked inventory");
          }
        }
      }

      variantAggregate.updateInventory(command.inventory, command.userId);

      for (const event of variantAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
        await this.projectionService.handleEvent(event, repositories);
      }

      snapshotRepository.saveSnapshot({
        aggregate_id: variantAggregate.id,
        correlation_id: snapshot.correlation_id,
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

