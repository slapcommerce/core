import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { CreateDropshipProductCommand } from "./commands";
import { DropshipProductAggregate } from "../../../../domain/dropshipProduct/aggregate";
import { SlugAggregate } from "../../../../domain/slug/slugAggregate";
import { CollectionAggregate } from "../../../../domain/collection/aggregate";
import { ProductPositionsWithinCollectionAggregate } from "../../../../domain/productPositionsWithinCollection/aggregate";
import { VariantPositionsWithinProductAggregate } from "../../../../domain/variantPositionsWithinProduct/aggregate";
import { randomUUIDv7 } from "bun";
import type { Service } from "../../../service";

export class CreateDropshipProductService
  implements Service<CreateDropshipProductCommand>
{
  constructor(private unitOfWork: UnitOfWork) {
    this.unitOfWork = unitOfWork;
  }

  async execute(command: CreateDropshipProductCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } =
        repositories;

      // Load or create slug aggregate
      const slugSnapshot = snapshotRepository.getSnapshot(command.slug);
      let slugAggregate: SlugAggregate;
      if (!slugSnapshot) {
        slugAggregate = SlugAggregate.create({
          slug: command.slug,
          correlationId: command.correlationId,
        });
      } else {
        slugAggregate = SlugAggregate.loadFromSnapshot(slugSnapshot);
      }

      // Check if slug is available
      if (!slugAggregate.isSlugAvailable()) {
        throw new Error(`Slug "${command.slug}" is already in use`);
      }

      // Generate UUID for variant positions aggregate
      const variantPositionsAggregateId = randomUUIDv7();

      // Create product aggregate with variantPositionsAggregateId
      const productAggregate = DropshipProductAggregate.create({
        id: command.id,
        correlationId: command.correlationId,
        userId: command.userId,
        name: command.name,
        description: command.description,
        slug: command.slug,
        collections: command.collections,
        variantPositionsAggregateId,
        richDescriptionUrl: command.richDescriptionUrl,
        vendor: command.vendor,
        variantOptions: command.variantOptions,
        metaTitle: command.metaTitle,
        metaDescription: command.metaDescription,
        tags: command.tags,
        taxable: command.taxable,
        taxId: command.taxId,
        dropshipSafetyBuffer: command.dropshipSafetyBuffer ?? 0,
        fulfillmentProviderId: command.fulfillmentProviderId ?? null,
        supplierCost: command.supplierCost ?? null,
        supplierSku: command.supplierSku ?? null,
      });

      // Create variant positions aggregate
      const variantPositionsAggregate =
        VariantPositionsWithinProductAggregate.create({
          id: variantPositionsAggregateId,
          productId: command.id,
          correlationId: command.correlationId,
          userId: command.userId,
        });

      // Reserve slug in registry
      slugAggregate.reserveSlug(command.id, "dropship_product", command.userId);

      // Handle product events
      for (const event of productAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Handle slug aggregate events
      for (const event of slugAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Handle variant positions aggregate events
      for (const event of variantPositionsAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Save product snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: productAggregate.id,
        correlationId: command.correlationId,
        version: productAggregate.version,
        payload: productAggregate.toSnapshot(),
      });

      // Save slug aggregate snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: slugAggregate.id,
        correlationId: command.correlationId,
        version: slugAggregate.version,
        payload: slugAggregate.toSnapshot(),
      });

      // Save variant positions aggregate snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: variantPositionsAggregateId,
        correlationId: command.correlationId,
        version: variantPositionsAggregate.version,
        payload: variantPositionsAggregate.toSnapshot(),
      });

      // Add all events to outbox
      for (const event of productAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
      for (const event of slugAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
      for (const event of variantPositionsAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }

      // Add product to each collection's positions aggregate
      for (const collectionId of command.collections) {
        // Load collection to get the positions aggregate ID
        const collectionSnapshot = snapshotRepository.getSnapshot(collectionId);
        if (!collectionSnapshot) continue;

        const collectionAggregate =
          CollectionAggregate.loadFromSnapshot(collectionSnapshot);
        const positionsAggregateId =
          collectionAggregate.productPositionsAggregateId;
        if (!positionsAggregateId) continue;

        const positionsSnapshot =
          snapshotRepository.getSnapshot(positionsAggregateId);
        if (!positionsSnapshot) continue;

        const positionsAggregate =
          ProductPositionsWithinCollectionAggregate.loadFromSnapshot(
            positionsSnapshot
          );
        positionsAggregate.addProduct(command.id, command.userId);

        // Save positions events
        for (const event of positionsAggregate.uncommittedEvents) {
          eventRepository.addEvent(event);
        }

        // Save positions snapshot
        snapshotRepository.saveSnapshot({
          aggregateId: positionsAggregateId,
          correlationId: command.correlationId,
          version: positionsAggregate.version,
          payload: positionsAggregate.toSnapshot(),
        });

        // Add positions events to outbox
        for (const event of positionsAggregate.uncommittedEvents) {
          outboxRepository.addOutboxEvent(event, {
            id: randomUUIDv7(),
          });
        }
      }
    });
  }
}
