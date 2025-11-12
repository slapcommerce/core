import type { DomainEvent } from "../domain/_base/domainEvent"
import type { EventRepository } from "./repositories/eventRepository"
import type { SnapshotRepository } from "./repositories/snapshotRepository"
import type { OutboxRepository } from "./repositories/outboxRepository"
import type { ProductListViewRepository } from "./repositories/productListViewRepository"
import type { ProductCollectionRepository } from "./repositories/productCollectionRepository"
import type { ProductVariantRepository } from "./repositories/productVariantRepository"
import type { SlugRedirectRepository } from "./repositories/slugRedirectRepository"

export type UnitOfWorkRepositories = {
  eventRepository: EventRepository
  snapshotRepository: SnapshotRepository
  outboxRepository: OutboxRepository
  productListViewRepository: ProductListViewRepository
  productCollectionRepository: ProductCollectionRepository
  productVariantRepository: ProductVariantRepository
  slugRedirectRepository: SlugRedirectRepository
}

export type ProjectionHandler = (
  event: DomainEvent<string, Record<string, unknown>>,
  repositories: UnitOfWorkRepositories
) => Promise<void>

export class ProjectionService {
  private handlers: Map<string, ProjectionHandler[]> = new Map()

  registerHandler(eventName: string, handler: ProjectionHandler): void {
    const existingHandlers = this.handlers.get(eventName) || []
    existingHandlers.push(handler)
    this.handlers.set(eventName, existingHandlers)
  }

  async handleEvent(
    event: DomainEvent<string, Record<string, unknown>>,
    repositories: UnitOfWorkRepositories
  ): Promise<void> {
    const handlers = this.handlers.get(event.eventName) || []
    
    for (const handler of handlers) {
      // Pass all repositories to handlers
      await handler(event, repositories)
    }
  }
}

