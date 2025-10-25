import type { DomainEvent, DomainEventPayload } from "./domainEvent";
import type AggregateType from "../aggregateTypes";

/**
 * Base abstract class that all domain aggregates must extend.
 *
 * Subclasses must define these static members:
 * - static readonly stateFields: readonly string[]
 * - static readonly stateVersion: number
 * - static readonly encryptedFields: readonly string[] (optional)
 * - static loadFromHistory(events: DomainEvent[]): T
 */
export abstract class DomainAggregate {
  // Static serialization configuration (must be overridden by subclasses)
  static readonly stateFields: readonly string[];
  static readonly stateVersion: number;
  static readonly encryptedFields: readonly string[];
  static readonly aggregateType: AggregateType;

  // Static rehydration method (must be implemented by subclasses)
  static loadFromHistory(
    events: DomainEvent<string, DomainEventPayload>[]
  ): DomainAggregate {
    throw new Error("loadFromHistory must be implemented by subclass");
  }

  // Core instance attributes (must be implemented by subclasses)
  abstract id: string;
  abstract version: number;
  abstract aggregateType: string;

  // Event tracking
  abstract events: DomainEvent<string, DomainEventPayload>[];
  abstract uncommittedEvents: DomainEvent<string, DomainEventPayload>[];

  // Event application method (must be implemented by subclasses)
  abstract apply(event: DomainEvent<string, DomainEventPayload>): void;
}

