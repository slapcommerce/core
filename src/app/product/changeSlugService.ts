import type { UnitOfWork } from "../../infrastructure/unitOfWork";
import type { ChangeSlugCommand } from "./commands";
import type { ProjectionService } from "../../infrastructure/projectionService";
import { ProductAggregate } from "../../domain/product/aggregate";
import { SlugAggregate } from "../../domain/slug/slugAggregate";
import { randomUUIDv7 } from "bun";

export class ChangeSlugService {
  constructor(
    private unitOfWork: UnitOfWork,
    private projectionService: ProjectionService,
  ) {
    this.unitOfWork = unitOfWork;
    this.projectionService = projectionService;
  }

  async execute(command: ChangeSlugCommand) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } =
        repositories;

      // Load product aggregate
      const productSnapshot = snapshotRepository.getSnapshot(command.id);
      if (!productSnapshot) {
        throw new Error(`Product with id ${command.id} not found`);
      }
      if (productSnapshot.version !== command.expectedVersion) {
        throw new Error(
          `Optimistic concurrency conflict: expected version ${command.expectedVersion} but found version ${productSnapshot.version}`,
        );
      }
      const productAggregate =
        ProductAggregate.loadFromSnapshot(productSnapshot);
      const oldSlug = productAggregate.slug;

      // Check if slug is different first
      if (oldSlug === command.newSlug) {
        throw new Error("New slug must be different from current slug");
      }

      // Load or create new slug aggregate
      const newSlugSnapshot = snapshotRepository.getSnapshot(command.newSlug);
      let newSlugAggregate: SlugAggregate;
      if (!newSlugSnapshot) {
        newSlugAggregate = SlugAggregate.create({
          slug: command.newSlug,
          correlationId: productSnapshot.correlation_id,
        });
      } else {
        newSlugAggregate = SlugAggregate.loadFromSnapshot(newSlugSnapshot);
      }

      // Check if new slug is available
      if (!newSlugAggregate.isSlugAvailable()) {
        throw new Error(`Slug "${command.newSlug}" is already in use`);
      }

      // Load old slug aggregate
      const oldSlugSnapshot = snapshotRepository.getSnapshot(oldSlug);
      if (!oldSlugSnapshot) {
        throw new Error(`Old slug "${oldSlug}" not found`);
      }
      const oldSlugAggregate = SlugAggregate.loadFromSnapshot(oldSlugSnapshot);

      // Change slug on product aggregate
      productAggregate.changeSlug(command.newSlug, command.userId);

      // Reserve new slug and mark old slug as redirected
      newSlugAggregate.reserveSlug(command.id, command.userId);
      oldSlugAggregate.markAsRedirect(command.newSlug, command.userId);

      // Handle product events and projections
      for (const event of productAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
        await this.projectionService.handleEvent(event, repositories);
      }

      // Handle slug aggregates events and projections
      for (const event of newSlugAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
        await this.projectionService.handleEvent(event, repositories);
      }
      for (const event of oldSlugAggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
        await this.projectionService.handleEvent(event, repositories);
      }

      // Save product snapshot
      snapshotRepository.saveSnapshot({
        aggregate_id: productAggregate.id,
        correlation_id: productSnapshot.correlation_id,
        version: productAggregate.version,
        payload: productAggregate.toSnapshot(),
      });

      // Save new slug snapshot
      snapshotRepository.saveSnapshot({
        aggregate_id: newSlugAggregate.id,
        correlation_id: newSlugAggregate.id, // Use slug as correlation_id for slug aggregates
        version: newSlugAggregate.version,
        payload: newSlugAggregate.toSnapshot(),
      });

      // Save old slug snapshot
      snapshotRepository.saveSnapshot({
        aggregate_id: oldSlugAggregate.id,
        correlation_id: oldSlugAggregate.id, // Use slug as correlation_id for slug aggregates
        version: oldSlugAggregate.version,
        payload: oldSlugAggregate.toSnapshot(),
      });

      // Add all events to outbox
      for (const event of productAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
      for (const event of newSlugAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
      for (const event of oldSlugAggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }
}
