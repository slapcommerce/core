import { randomUUIDv7 } from "bun";
import { z } from "zod";
import type { UnitOfWork } from "../../infrastructure/unitOfWork";
import type { ProjectionService } from "../../infrastructure/projectionService";
import { ProductAggregate } from "../../domain/product/aggregate";
import { UpdateProductFulfillmentTypeCommand } from "./commands";

export class UpdateProductFulfillmentTypeService {
    constructor(
        private unitOfWork: UnitOfWork,
        private projectionService: ProjectionService,
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
                    digitalAssetUrl: command.digitalAssetUrl,
                    maxLicenses: command.maxLicenses,
                    dropshipSafetyBuffer: command.dropshipSafetyBuffer,
                },
                command.userId,
            );

            // Persist events
            for (const event of productAggregate.uncommittedEvents) {
                await eventRepository.addEvent(event);
                await this.projectionService.handleEvent(event, repositories);
            }

            // Save snapshot
            await snapshotRepository.saveSnapshot({
                aggregate_id: productAggregate.id,
                correlation_id: snapshot.correlation_id,
                version: productAggregate.version,
                payload: productAggregate.toSnapshot(),
            });

            // Add to outbox
            for (const event of productAggregate.uncommittedEvents) {
                await outboxRepository.addOutboxEvent(event, {
                    id: randomUUIDv7(),
                });
            }
        });
    }
}
