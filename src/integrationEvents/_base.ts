export interface IntegrationEvent<
  Name extends string,
  Payload extends Record<string, unknown>
> {
  eventId: string;
  aggregateId: string;
  version: number;
  eventName: Name;
  occurredAt: Date;
  correlationId: string;
  payload: Payload;
}
