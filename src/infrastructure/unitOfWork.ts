import { LuaCommandTransaction } from "./redis";
import type redis from "ioredis";
import { AggregateTypeRepository, EventRepository } from "./repositories";

export class UnitOfWork {
  private redis: redis;
  private commandId: string;
  private aggregateType: string;
  private eventRepositoryFactory: typeof EventRepository;
  private aggregateTypeRepositoryFactory: typeof AggregateTypeRepository;

  constructor(
    redis: redis,
    eventRepositoryFactory: typeof EventRepository,
    aggregateTypeRepositoryFactory: typeof AggregateTypeRepository,
    commandId: string,
    aggregateType: string
  ) {
    this.redis = redis;
    this.commandId = commandId;
    this.aggregateType = aggregateType;
    this.eventRepositoryFactory = eventRepositoryFactory;
    this.aggregateTypeRepositoryFactory = aggregateTypeRepositoryFactory;
  }

  async withTransaction<T>(
    work: (context: {
      eventRepository: EventRepository;
      aggregateTypeRepository: AggregateTypeRepository;
    }) => Promise<T>
  ): Promise<T> {
    const luaTransaction = new LuaCommandTransaction(
      this.redis,
      this.commandId,
      this.aggregateType
    );
    const eventRepository = new this.eventRepositoryFactory(luaTransaction);
    const aggregateTypeRepository = new this.aggregateTypeRepositoryFactory(
      luaTransaction
    );
    const result = await work({ eventRepository, aggregateTypeRepository });
    await luaTransaction.commit();
    return result;
  }
}
