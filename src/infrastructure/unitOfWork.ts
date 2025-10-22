import { LuaCommandTransaction } from "./redis";
import type redis from "ioredis";
import { AggregateTypeRepository, EventRepository } from "./repositories";

export class UnitOfWork {
  private redis: redis;
  private eventRepositoryFactory: typeof EventRepository;
  private aggregateTypeRepositoryFactory: typeof AggregateTypeRepository;

  constructor(
    redis: redis,
    eventRepositoryFactory: typeof EventRepository,
    aggregateTypeRepositoryFactory: typeof AggregateTypeRepository
  ) {
    this.redis = redis;
    this.eventRepositoryFactory = eventRepositoryFactory;
    this.aggregateTypeRepositoryFactory = aggregateTypeRepositoryFactory;
  }

  async withTransaction<T>(
    work: (context: {
      eventRepository: EventRepository;
      aggregateTypeRepository: AggregateTypeRepository;
    }) => Promise<T>
  ): Promise<T> {
    const luaTransaction = new LuaCommandTransaction(this.redis);
    const eventRepository = new this.eventRepositoryFactory(luaTransaction);
    const aggregateTypeRepository = new this.aggregateTypeRepositoryFactory(
      luaTransaction
    );
    const result = await work({ eventRepository, aggregateTypeRepository });
    await luaTransaction.commit();
    return result;
  }
}
