export interface IntegrationEvent<
  Name extends string,
  Payload extends Record<string, unknown>,
> {
  eventId: string;
  eventName: Name;
  occurredAt: Date;
  correlationId: string;
  causationId: string;
  aggregateId: string;
  aggregateVersion: number;
  routingKey: string;
  payload: Payload;
}
