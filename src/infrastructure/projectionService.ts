import type { DomainEvent } from "../domain/_base/domainEvent"
import type { ProjectionRepository } from "./repository"

export type ProjectionHandler = (
  event: DomainEvent<string, Record<string, unknown>>,
  repository: ProjectionRepository
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
    repository: ProjectionRepository
  ): Promise<void> {
    const handlers = this.handlers.get(event.eventName) || []
    
    for (const handler of handlers) {
      await handler(event, repository)
    }
  }
}

