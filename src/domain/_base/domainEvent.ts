export type DomainEventPayload = Record<string, unknown>;

export interface DomainEvent<
  Name extends string,
  P extends DomainEventPayload
> {
  occurredAt: Date;
  eventName: Name;
  correlationId: string;
  aggregateId: string;
  version: number;
  payload: P;
}
