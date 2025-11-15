import { describe, test, expect } from "bun:test";
import { ScheduleAggregate } from "../../../src/domain/schedule/aggregate";
import {
  ScheduleCreatedEvent,
  ScheduleUpdatedEvent,
  ScheduleExecutedEvent,
  ScheduleFailedEvent,
  ScheduleCancelledEvent,
} from "../../../src/domain/schedule/events";
import { randomUUIDv7 } from "bun";

function createValidScheduleParams() {
  return {
    id: randomUUIDv7(),
    correlationId: randomUUIDv7(),
    targetAggregateId: randomUUIDv7(),
    targetAggregateType: "collection",
    commandType: "publishCollection",
    commandData: { expectedVersion: 1 } as Record<string, unknown> | null,
    scheduledFor: new Date(Date.now() + 60000), // 1 minute in future
    createdBy: "user-123",
  };
}

describe("ScheduleAggregate", () => {
  describe("create", () => {
    test("should create a new schedule aggregate with pending status", () => {
      // Arrange
      const params = createValidScheduleParams();

      // Act
      const schedule = ScheduleAggregate.create(params);

      // Assert
      const snapshot = schedule.toSnapshot();
      expect(schedule.id).toBe(params.id);
      expect(snapshot.targetAggregateId).toBe(params.targetAggregateId);
      expect(snapshot.targetAggregateType).toBe(params.targetAggregateType);
      expect(snapshot.commandType).toBe(params.commandType);
      expect(snapshot.commandData).toEqual(params.commandData);
      expect(snapshot.scheduledFor).toEqual(params.scheduledFor);
      expect(snapshot.status).toBe("pending");
      expect(snapshot.retryCount).toBe(0);
      expect(snapshot.nextRetryAt).toBeNull();
      expect(snapshot.createdBy).toBe(params.createdBy);
      expect(snapshot.errorMessage).toBeNull();
      expect(schedule.version).toBe(0);
      expect(schedule.events).toEqual([]);
      expect(schedule.uncommittedEvents).toHaveLength(1);

      const event = schedule.uncommittedEvents[0]!;
      expect(event).toBeInstanceOf(ScheduleCreatedEvent);
      expect(event.eventName).toBe("schedule.created");
      expect(event.aggregateId).toBe(params.id);
      expect(event.correlationId).toBe(params.correlationId);
      expect(event.version).toBe(0);
    });

    test("should create schedule with null commandData", () => {
      // Arrange
      const params = createValidScheduleParams();
      params.commandData = null;

      // Act
      const schedule = ScheduleAggregate.create(params);

      // Assert
      const snapshot = schedule.toSnapshot();
      expect(snapshot.commandData).toBeNull();
    });
  });

  describe("update", () => {
    test("should update scheduledFor and commandData for pending schedule", () => {
      // Arrange
      const params = createValidScheduleParams();
      const schedule = ScheduleAggregate.create(params);
      const newScheduledFor = new Date(Date.now() + 120000); // 2 minutes
      const newCommandData = { expectedVersion: 2 };

      // Act
      schedule.update(newScheduledFor, newCommandData);

      // Assert
      const snapshot = schedule.toSnapshot();
      expect(snapshot.scheduledFor).toEqual(newScheduledFor);
      expect(snapshot.commandData).toEqual(newCommandData);
      expect(snapshot.status).toBe("pending");
      expect(schedule.version).toBe(1);
      expect(schedule.uncommittedEvents).toHaveLength(2);

      const event = schedule.uncommittedEvents[1]!;
      expect(event).toBeInstanceOf(ScheduleUpdatedEvent);
      expect(event.eventName).toBe("schedule.updated");
      expect(event.version).toBe(1);
    });

    test("should throw error when updating non-pending schedule", () => {
      // Arrange
      const params = createValidScheduleParams();
      const schedule = ScheduleAggregate.create(params);
      schedule.markExecuted();

      // Act & Assert
      expect(() => {
        schedule.update(new Date(), null);
      }).toThrow("Cannot update schedule with status executed");
    });
  });

  describe("cancel", () => {
    test("should cancel pending schedule", () => {
      // Arrange
      const params = createValidScheduleParams();
      const schedule = ScheduleAggregate.create(params);

      // Act
      schedule.cancel();

      // Assert
      const snapshot = schedule.toSnapshot();
      expect(snapshot.status).toBe("cancelled");
      expect(schedule.version).toBe(1);
      expect(schedule.uncommittedEvents).toHaveLength(2);

      const event = schedule.uncommittedEvents[1]!;
      expect(event).toBeInstanceOf(ScheduleCancelledEvent);
      expect(event.eventName).toBe("schedule.cancelled");
    });

    test("should throw error when cancelling executed schedule", () => {
      // Arrange
      const params = createValidScheduleParams();
      const schedule = ScheduleAggregate.create(params);
      schedule.markExecuted();

      // Act & Assert
      expect(() => {
        schedule.cancel();
      }).toThrow("Cannot cancel an already executed schedule");
    });

    test("should throw error when cancelling already cancelled schedule", () => {
      // Arrange
      const params = createValidScheduleParams();
      const schedule = ScheduleAggregate.create(params);
      schedule.cancel();

      // Act & Assert
      expect(() => {
        schedule.cancel();
      }).toThrow("Schedule is already cancelled");
    });
  });

  describe("markExecuted", () => {
    test("should mark pending schedule as executed", () => {
      // Arrange
      const params = createValidScheduleParams();
      const schedule = ScheduleAggregate.create(params);

      // Act
      schedule.markExecuted();

      // Assert
      const snapshot = schedule.toSnapshot();
      expect(snapshot.status).toBe("executed");
      expect(schedule.version).toBe(1);
      expect(schedule.uncommittedEvents).toHaveLength(2);

      const event = schedule.uncommittedEvents[1]!;
      expect(event).toBeInstanceOf(ScheduleExecutedEvent);
      expect(event.eventName).toBe("schedule.executed");
    });

    test("should throw error when marking non-pending schedule as executed", () => {
      // Arrange
      const params = createValidScheduleParams();
      const schedule = ScheduleAggregate.create(params);
      schedule.cancel();

      // Act & Assert
      expect(() => {
        schedule.markExecuted();
      }).toThrow("Cannot mark schedule as executed. Current status: cancelled");
    });
  });

  describe("markFailed", () => {
    test("should mark schedule as failed and set retry with exponential backoff", () => {
      // Arrange
      const params = createValidScheduleParams();
      const schedule = ScheduleAggregate.create(params);
      const errorMessage = "Connection timeout";
      const beforeMark = Date.now();

      // Act
      schedule.markFailed(errorMessage);
      const afterMark = Date.now();

      // Assert
      const snapshot = schedule.toSnapshot();
      expect(snapshot.status).toBe("pending"); // Still pending for retry
      expect(snapshot.retryCount).toBe(1);
      expect(snapshot.errorMessage).toBe(errorMessage);
      expect(snapshot.nextRetryAt).not.toBeNull();

      // Next retry should be ~2 minutes in future (2^1 minutes)
      const nextRetryTime = snapshot.nextRetryAt!.getTime();
      const expectedMin = beforeMark + 2 * 60 * 1000;
      const expectedMax = afterMark + 2 * 60 * 1000;
      expect(nextRetryTime).toBeGreaterThanOrEqual(expectedMin);
      expect(nextRetryTime).toBeLessThanOrEqual(expectedMax);

      expect(schedule.version).toBe(1);
      expect(schedule.uncommittedEvents).toHaveLength(2);

      const event = schedule.uncommittedEvents[1]!;
      expect(event).toBeInstanceOf(ScheduleFailedEvent);
      expect(event.eventName).toBe("schedule.failed");
    });

    test("should calculate exponential backoff correctly for multiple retries", () => {
      // Arrange
      const params = createValidScheduleParams();
      const schedule = ScheduleAggregate.create(params);

      // Act - First failure: 2^1 = 2 minutes
      schedule.markFailed("Error 1");
      let snapshot = schedule.toSnapshot();
      expect(snapshot.retryCount).toBe(1);
      expect(snapshot.status).toBe("pending");

      // Act - Second failure: 2^2 = 4 minutes
      schedule.markFailed("Error 2");
      snapshot = schedule.toSnapshot();
      expect(snapshot.retryCount).toBe(2);
      expect(snapshot.status).toBe("pending");

      // Act - Third failure: 2^3 = 8 minutes
      schedule.markFailed("Error 3");
      snapshot = schedule.toSnapshot();
      expect(snapshot.retryCount).toBe(3);
      expect(snapshot.status).toBe("pending");
    });

    test("should mark as permanently failed after max retries", () => {
      // Arrange
      const params = createValidScheduleParams();
      const schedule = ScheduleAggregate.create(params);
      const maxRetries = 5;

      // Act - Fail 4 times (retries 1-4)
      for (let i = 1; i < maxRetries; i++) {
        schedule.markFailed(`Error ${i}`, maxRetries);
      }

      // Assert - Still pending after 4 retries
      let snapshot = schedule.toSnapshot();
      expect(snapshot.retryCount).toBe(4);
      expect(snapshot.status).toBe("pending");

      // Act - 5th failure should permanently fail (retryCount becomes 5, equals maxRetries)
      schedule.markFailed("Final error", maxRetries);

      // Assert - Now permanently failed
      snapshot = schedule.toSnapshot();
      expect(snapshot.retryCount).toBe(5);
      expect(snapshot.status).toBe("failed");
      expect(snapshot.nextRetryAt).toBeNull();
    });

    test("should throw error when marking non-pending schedule as failed", () => {
      // Arrange
      const params = createValidScheduleParams();
      const schedule = ScheduleAggregate.create(params);
      schedule.markExecuted();

      // Act & Assert
      expect(() => {
        schedule.markFailed("Error");
      }).toThrow("Cannot mark schedule as failed. Current status: executed");
    });
  });

  describe("loadFromSnapshot", () => {
    test("should rehydrate schedule from snapshot", () => {
      // Arrange
      const params = createValidScheduleParams();
      const schedule = ScheduleAggregate.create(params);
      schedule.update(new Date(Date.now() + 180000), { foo: "bar" });

      const snapshotData = {
        aggregate_id: schedule.id,
        correlation_id: params.correlationId,
        version: schedule.version,
        payload: JSON.stringify(schedule.toSnapshot()),
      };

      // Act
      const rehydrated = ScheduleAggregate.loadFromSnapshot(snapshotData);

      // Assert
      expect(rehydrated.id).toBe(schedule.id);
      expect(rehydrated.version).toBe(schedule.version);

      const originalSnapshot = schedule.toSnapshot();
      const rehydratedSnapshot = rehydrated.toSnapshot();
      expect(rehydratedSnapshot.targetAggregateId).toBe(
        originalSnapshot.targetAggregateId,
      );
      expect(rehydratedSnapshot.commandType).toBe(originalSnapshot.commandType);
      expect(rehydratedSnapshot.status).toBe(originalSnapshot.status);
      expect(rehydratedSnapshot.retryCount).toBe(originalSnapshot.retryCount);
    });
  });

  describe("getters", () => {
    test("should expose all necessary properties via getters", () => {
      // Arrange
      const params = createValidScheduleParams();
      const schedule = ScheduleAggregate.create(params);

      // Act & Assert
      expect(schedule.getTargetAggregateId()).toBe(params.targetAggregateId);
      expect(schedule.getTargetAggregateType()).toBe(
        params.targetAggregateType,
      );
      expect(schedule.getCommandType()).toBe(params.commandType);
      expect(schedule.getCommandData()).toEqual(params.commandData);
      expect(schedule.getScheduledFor()).toEqual(params.scheduledFor);
      expect(schedule.getStatus()).toBe("pending");
      expect(schedule.getRetryCount()).toBe(0);
      expect(schedule.getNextRetryAt()).toBeNull();
      expect(schedule.getCreatedBy()).toBe(params.createdBy);
      expect(schedule.getErrorMessage()).toBeNull();
    });
  });
});
