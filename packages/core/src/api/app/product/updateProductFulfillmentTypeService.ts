import { randomUUIDv7 } from "bun";
import { z } from "zod";
import type { UnitOfWork } from "../../infrastructure/unitOfWork";
import { ProductAggregate } from "../../domain/product/aggregate";
import { VariantAggregate } from "../../domain/variant/aggregate";
import { UpdateProductFulfillmentTypeCommand } from "./commands";
import type { AccessLevel } from "../accessLevel";
import type { Service } from "../service";

export class UpdateProductFulfillmentTypeService implements Service<UpdateProductFulfillmentTypeCommand> {
  accessLevel: AccessLevel = "admin";

  constructor(
    private unitOfWork: UnitOfWork,

    ) { }

    async execute(command: z.infer<typeof UpdateProductFulfillmentTypeCommand>) {
        return await this.unitOfWork.withTransaction(async (repositories) => {
            const { eventRepository, snapshotRepository, outboxRepository } =
                repositories;

            const snapshot = await snapshotRepository.getSnapshot(command.id);
            if (!snapshot) {
                throw new Error(`Product with id ${command.id} not found`);
            }

            if (snapshot.version !== command.expectedVersion) {
                throw new Error(
                    `Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${snapshot.version}`,
                );
            }

            const productAggregate = ProductAggregate.loadFromSnapshot(snapshot);

            productAggregate.updateFulfillmentType(
                command.fulfillmentType,
                {
                    dropshipSafetyBuffer: command.dropshipSafetyBuffer,
                },
                command.userId,
            );

            // Handle side effects: If switching to Digital, reset all variant inventories
            if (command.fulfillmentType === "digital") {
                for (const variantId of productAggregate.variantIds) {
                    const variantSnapshot = await snapshotRepository.getSnapshot(variantId);
                    if (variantSnapshot) {
                        const variantAggregate = VariantAggregate.loadFromSnapshot(variantSnapshot);
                        variantAggregate.forceInventoryReset(command.userId);

                        // Persist variant events
                        for (const event of variantAggregate.uncommittedEvents) {
                            await eventRepository.addEvent(event);
                        }

                        // Save variant snapshot
                        await snapshotRepository.saveSnapshot({
                            aggregate_id: variantAggregate.id,
                            correlation_id: variantSnapshot.correlation_id,
                            version: variantAggregate.version,
                            payload: variantAggregate.toSnapshot(),
                        });

                        // Add variant events to outbox
                        for (const event of variantAggregate.uncommittedEvents) {
                            await outboxRepository.addOutboxEvent(event, {
                                id: randomUUIDv7(),
                            });
                        }
                    }
                }
            }

            // Persist product events
            for (const event of productAggregate.uncommittedEvents) {
                await eventRepository.addEvent(event);
            }

            // Save product snapshot
            await snapshotRepository.saveSnapshot({
                aggregate_id: productAggregate.id,
                correlation_id: snapshot.correlation_id,
                version: productAggregate.version,
                payload: productAggregate.toSnapshot(),
            });

            // Add product events to outbox
            for (const event of productAggregate.uncommittedEvents) {
                await outboxRepository.addOutboxEvent(event, {
                    id: randomUUIDv7(),
                });
            }
        });
    }
}
