export type DomainEventPayload = Record<string, unknown>;

/**
 * Helper type for events that include prior and new state
 */
export type StateBasedPayload<T> = {
  priorState: T;
  newState: T;
};

export interface DomainEvent<
  Name extends string,
  P extends DomainEventPayload,
> {
  occurredAt: Date;
  eventName: Name;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: P;
}
