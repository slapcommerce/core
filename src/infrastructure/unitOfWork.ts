import { LuaCommandTransaction } from "./redis";
import type redis from "ioredis";
import {
  AggregateTypeRepository,
  EventRepository,
  SnapshotRepository,
} from "./repositories";

export class UnitOfWork {
  private redis: redis;
  private commandId: string;
  private aggregateType: string;
  private eventRepositoryFactory: typeof EventRepository;
  private aggregateTypeRepositoryFactory: typeof AggregateTypeRepository;
  private snapshotRepositoryFactory: typeof SnapshotRepository;

  constructor(
    redis: redis,
    eventRepositoryFactory: typeof EventRepository,
    aggregateTypeRepositoryFactory: typeof AggregateTypeRepository,
    snapshotRepositoryFactory: typeof SnapshotRepository,
    commandId: string,
    aggregateType: string
  ) {
    this.redis = redis;
    this.commandId = commandId;
    this.aggregateType = aggregateType;
    this.eventRepositoryFactory = eventRepositoryFactory;
    this.aggregateTypeRepositoryFactory = aggregateTypeRepositoryFactory;
    this.snapshotRepositoryFactory = snapshotRepositoryFactory;
  }

  async withTransaction<T>(
    work: (context: {
      eventRepository: EventRepository;
      aggregateTypeRepository: AggregateTypeRepository;
      snapshotRepository: SnapshotRepository;
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
    const snapshotRepository = new this.snapshotRepositoryFactory(
      luaTransaction
    );
    const result = await work({
      eventRepository,
      aggregateTypeRepository,
      snapshotRepository,
    });
    await luaTransaction.commit();
    return result;
  }
}
