import type { UnitOfWork } from "../../infrastructure/unitOfWork";
import type { CreateProductCommand } from "./commands";
import { ProductAggregate } from "../../domain/product/aggregate";
import { SlugAggregate } from "../../domain/slug/slugAggregate";
import { randomUUIDv7 } from "bun";
import type { AccessLevel } from "../accessLevel";
import type { Service } from "../service";

export class CreateProductService implements Service<CreateProductCommand> {
  accessLevel: AccessLevel = "admin";

  constructor(
    private unitOfWork: UnitOfWork,
  ) {
    this.unitOfWork = unitOfWork;
  }
  async execute(command: CreateProductCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } = repositories;
      
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

      // Create product aggregate
      const productAggregate = ProductAggregate.create(command);
      
      // Reserve slug in registry
      slugAggregate.reserveSlug(command.id, command.userId);

      // Handle product events
      for (const event of productAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Handle slug aggregate events
      for (const event of slugAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Save product snapshot
      snapshotRepository.saveSnapshot({
        aggregate_id: productAggregate.id,
        correlation_id: command.correlationId,
        version: productAggregate.version,
        payload: productAggregate.toSnapshot(),
      });

      // Save slug aggregate snapshot
      snapshotRepository.saveSnapshot({
        aggregate_id: slugAggregate.id,
        correlation_id: command.correlationId,
        version: slugAggregate.version,
        payload: slugAggregate.toSnapshot(),
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
    });
  }
}