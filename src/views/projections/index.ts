import type {
  DomainEvent,
  DomainEventPayload,
} from "../../domain/_base/domainEvent";
import { LuaProjectionTransaction, redis } from "../../infrastructure/redis";
import { ProductProjection } from "./productProjection";
import type { ProductCreatedEvent } from "../../domain/product/events";

export class ProjectionService {
  private productProjectionFactory: typeof ProductProjection;

  constructor() {
    this.productProjectionFactory = ProductProjection;
  }

  async handle(
    event: DomainEvent<string, DomainEventPayload>,
    txFactory: typeof LuaProjectionTransaction
  ): Promise<void> {
    const tx = new txFactory(redis);
    const expectedVersion = event.version - 1;
    tx.setExpectedVersion(expectedVersion);
    let eventSkipped = false;
    switch (event.eventName) {
      case "product.created":
        const productProjection = new this.productProjectionFactory(tx, redis);
        await productProjection.handleProductCreated(
          event as ProductCreatedEvent
        );
        break;
      default:
        console.warn(`No projection handler for event: ${event.eventName}`);
        eventSkipped = true;
    }
    if (!eventSkipped) {
      await tx.commit();
    }
  }
}
