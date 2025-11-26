import type { Database } from "bun:sqlite";
import { GetCollectionsService } from "../../app/collection/queries/admin/getCollectionsService";
import { CollectionViewQueryHandler } from "../../app/collection/queries/admin/getCollectionService";
import { GetSlugRedirectChainService } from "../../app/collection/queries/admin/getSlugRedirectChainService";
import { GetSchedulesService } from "../../app/schedule/queries/admin/getSchedulesService";
import { GetScheduleService } from "../../app/schedule/queries/admin/getScheduleService";
import {
  GetCollectionsQuery,
  GetCollectionQuery,
  GetSlugRedirectChainQuery,
} from "../../app/collection/queries/admin/queries";
import {
  GetSchedulesQuery,
  GetScheduleQuery,
} from "../../app/schedule/queries/admin/queries";

export type QueryType =
  | "getCollections"
  | "getCollection"
  | "getSchedules"
  | "getSchedule"
  | "getSlugRedirectChain";

type QueryResult<T> =
  | { success: true; data: T }
  | { success: false; error: Error };

interface QueryHandler {
  parse: (params: unknown) => unknown;
  execute: (params: unknown) => unknown;
}

/**
 * AdminQueriesRouter routes admin queries to their corresponding query services.
 * Uses a Map-based registry for query dispatch.
 */
export class AdminQueriesRouter {
  private readonly handlers: Map<QueryType, QueryHandler>;

  private constructor(db: Database) {
    this.handlers = new Map();
    this.initializeHandlers(db);
  }

  /**
   * Creates a new AdminQueriesRouter instance
   */
  static create(db: Database): AdminQueriesRouter {
    return new AdminQueriesRouter(db);
  }

  /**
   * Executes a query by type and params
   */
  execute(type: QueryType, params: unknown): QueryResult<unknown> {
    if (!type) {
      return { success: false, error: new Error("Request must include type") };
    }

    const handler = this.handlers.get(type);
    if (!handler) {
      return { success: false, error: new Error(`Unknown query type: ${type}`) };
    }

    try {
      const parsedParams = handler.parse(params ?? {});
      const result = handler.execute(parsedParams);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  private initializeHandlers(db: Database): void {
    // Collection queries
    const getCollectionsService = new GetCollectionsService(db);
    this.handlers.set("getCollections", {
      parse: (p) => GetCollectionsQuery.parse(p),
      execute: (p) => getCollectionsService.handle(p as GetCollectionsQuery),
    });

    const collectionViewQueryHandler = new CollectionViewQueryHandler(db);
    this.handlers.set("getCollection", {
      parse: (p) => GetCollectionQuery.parse(p),
      execute: (p) => collectionViewQueryHandler.handle(p as GetCollectionQuery),
    });

    const getSlugRedirectChainService = new GetSlugRedirectChainService(db);
    this.handlers.set("getSlugRedirectChain", {
      parse: (p) => GetSlugRedirectChainQuery.parse(p),
      execute: (p) => getSlugRedirectChainService.handle(p as GetSlugRedirectChainQuery),
    });

    // Schedule queries
    const getSchedulesService = new GetSchedulesService(db);
    this.handlers.set("getSchedules", {
      parse: (p) => GetSchedulesQuery.parse(p),
      execute: (p) => getSchedulesService.handle(p as GetSchedulesQuery),
    });

    const getScheduleService = new GetScheduleService(db);
    this.handlers.set("getSchedule", {
      parse: (p) => GetScheduleQuery.parse(p),
      execute: (p) => getScheduleService.handle(p as GetScheduleQuery),
    });
  }
}
