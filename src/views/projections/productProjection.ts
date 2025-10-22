import type { LuaProjectionTransaction } from "../../infrastructure/redis";
import type { ProductCreatedEvent } from "../../domain/product/events";
import type { Redis } from "ioredis";

export class ProductProjection {
  private tx: LuaProjectionTransaction;
  private redis: Redis;

  constructor(tx: LuaProjectionTransaction, redis: Redis) {
    this.tx = tx;
    this.redis = redis;
  }

  async handleProductCreated(event: ProductCreatedEvent) {
    const aggregateKey = `aggregate:${event.aggregateId}`;
    this.tx.set(event.aggregateId, aggregateKey, JSON.stringify(event.payload));
    const productsListKey = "products:all";
    this.tx.zadd(
      event.aggregateId,
      productsListKey,
      event.createdAt.getTime(),
      event.aggregateId
    );
  }
}
