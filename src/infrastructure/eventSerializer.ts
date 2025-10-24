import { encode, decode } from "@msgpack/msgpack";
import type { DomainEvent } from "../domain/_base/domainEvent";
import { ProductCreatedEvent } from "../domain/product/events";
import { encryptField, decryptField } from "./utils/encryption";

type SerializedEvent = readonly [
  string,
  number,
  string,
  string,
  number,
  readonly [number, readonly any[]]
];

type EventClass = {
  new (params: any): DomainEvent<string, Record<string, unknown>>;
  encryptedFields?: string[];
  payloadFields?: readonly string[];
  payloadVersion?: number;
};

const EVENT_REGISTRY: Record<string, EventClass> = {
  "product.created": ProductCreatedEvent,
};

export function registerTestEvent(
  eventName: string,
  eventClass: EventClass
): void {
  EVENT_REGISTRY[eventName] = eventClass;
}

export class EventSerializer {
  async serialize(event: DomainEvent<string, Record<string, unknown>>) {
    const EventClass = EVENT_REGISTRY[event.eventName];
    if (!EventClass) {
      throw new Error(`Unknown event type: ${event.eventName}`);
    }

    if (!EventClass.payloadFields) {
      throw new Error(
        `Event ${event.eventName} does not have payloadFields defined`
      );
    }

    // Convert payload object to array based on field order
    const payloadArray = EventClass.payloadFields.map((fieldName: string) => {
      return event.payload[fieldName];
    });

    // Handle encryption for specific fields
    const encryptedFields = EventClass.encryptedFields;
    if (encryptedFields && encryptedFields.length > 0) {
      for (let i = 0; i < EventClass.payloadFields.length; i++) {
        const fieldName = EventClass.payloadFields[i];
        const value = payloadArray[i];

        if (
          fieldName &&
          encryptedFields.includes(fieldName) &&
          value !== undefined
        ) {
          payloadArray[i] = await encryptField(value);
        }
      }
    }

    const serializedPayload = [EventClass.payloadVersion || 1, payloadArray];

    const arrayFormat = [
      event.eventName,
      Math.floor(event.occurredAt.getTime() / 1000),
      event.correlationId,
      event.aggregateId,
      event.version,
      serializedPayload,
    ];
    return encode(arrayFormat);
  }

  async deserialize(data: Uint8Array) {
    const [
      eventName,
      occurredAt,
      correlationId,
      aggregateId,
      version,
      rawPayload,
    ] = decode(data) as SerializedEvent;

    const EventClass = EVENT_REGISTRY[eventName];
    if (!EventClass) {
      throw new Error(`Unknown event name: ${eventName}`);
    }

    if (!EventClass.payloadFields) {
      throw new Error(`Event ${eventName} does not have payloadFields defined`);
    }

    // Array-based payload with versioning
    const [payloadVersion, payloadArray] = rawPayload as [number, any[]];

    // Convert array back to object based on field order
    const payload: any = {};
    const encryptedFields = EventClass.encryptedFields || [];

    for (let i = 0; i < EventClass.payloadFields.length; i++) {
      const fieldName = EventClass.payloadFields[i];
      let value = payloadArray[i];

      if (fieldName) {
        // Handle decryption for specific fields
        if (
          encryptedFields.includes(fieldName) &&
          value !== undefined &&
          value !== null
        ) {
          value = await decryptField(value);
        }

        // Convert null to undefined for missing fields
        payload[fieldName] = value === null ? undefined : value;
      }
    }

    return new EventClass({
      occurredAt: new Date(occurredAt * 1000),
      correlationId: correlationId,
      aggregateId: aggregateId,
      version: version,
      payload: payload,
      committed: true,
    });
  }
}
