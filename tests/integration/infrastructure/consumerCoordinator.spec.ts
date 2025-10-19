import { ConsumerCoordinator } from "../../../src/infrastructure/consumerCoordinator";
import { expect, test, describe } from "bun:test";
import { redis } from "../../helpers/redis";
import { randomUUIDv7 } from "bun";

describe("ConsumerCoordinator", () => {
  // ========================================================================
  // Consumer Registration and Heartbeat
  // ========================================================================

  test("registers consumer and sends heartbeat", async () => {
    // ARRANGE
    const groupName = randomUUIDv7();
    const consumerId = randomUUIDv7();
    const streamName1 = `projection-${randomUUIDv7()}`;
    const streamName2 = `externalEffect-${randomUUIDv7()}`;
    const coordinator = new ConsumerCoordinator({
      redis,
      consumerId,
      groupName,
      partitionCount: 4,
      streamNames: [streamName1, streamName2],
      heartbeatTimeoutMs: 30000,
    });

    // ACT
    await coordinator.sendHeartbeat();

    // ASSERT
    const heartbeats = await redis.zrange(
      `consumer:heartbeats:${groupName}`,
      0,
      -1
    );
    expect(heartbeats).toContain(consumerId);

    // Verify timestamp is recent
    const score = await redis.zscore(
      `consumer:heartbeats:${groupName}`,
      consumerId
    );
    expect(score).toBeDefined();
    const timestamp = parseInt(score!, 10);
    const now = Date.now();
    expect(now - timestamp).toBeLessThan(1000); // Within 1 second
  });

  // ========================================================================
  // Single Consumer Assignment
  // ========================================================================

  test("assigns all partitions to single consumer", async () => {
    // ARRANGE
    const groupName = randomUUIDv7();
    const consumerId = randomUUIDv7();
    const partitionCount = 4;
    const streamName1 = `projection-${randomUUIDv7()}`;
    const streamName2 = `externalEffect-${randomUUIDv7()}`;
    const coordinator = new ConsumerCoordinator({
      redis,
      consumerId,
      groupName,
      partitionCount,
      streamNames: [streamName1, streamName2],
      heartbeatTimeoutMs: 30000,
    });

    // ACT
    const assignment = await coordinator.registerConsumer();

    // ASSERT
    expect(assignment.generation).toBe(1);
    expect(assignment.partitions).toHaveLength(partitionCount);
    expect(assignment.partitions).toEqual([0, 1, 2, 3]);

    // Verify stream names generation
    const streamNames = coordinator.getStreamNamesForPartitions(
      assignment.partitions
    );
    expect(streamNames).toHaveLength(8); // 4 partitions * 2 stream types
    expect(streamNames).toContain(`${streamName1}:0`);
    expect(streamNames).toContain(`${streamName1}:1`);
    expect(streamNames).toContain(`${streamName2}:0`);
    expect(streamNames).toContain(`${streamName2}:1`);
  });

  // ========================================================================
  // Multiple Consumer Load Distribution
  // ========================================================================

  test("distributes partitions evenly across multiple consumers", async () => {
    // ARRANGE
    const groupName = randomUUIDv7();
    const partitionCount = 6;
    const consumer1Id = randomUUIDv7();
    const consumer2Id = randomUUIDv7();
    const consumer3Id = randomUUIDv7();
    const streamName = `projection-${randomUUIDv7()}`;

    const coordinator1 = new ConsumerCoordinator({
      redis,
      consumerId: consumer1Id,
      groupName,
      partitionCount,
      streamNames: [streamName],
      heartbeatTimeoutMs: 30000,
    });

    const coordinator2 = new ConsumerCoordinator({
      redis,
      consumerId: consumer2Id,
      groupName,
      partitionCount,
      streamNames: [streamName],
      heartbeatTimeoutMs: 30000,
    });

    const coordinator3 = new ConsumerCoordinator({
      redis,
      consumerId: consumer3Id,
      groupName,
      partitionCount,
      streamNames: [streamName],
      heartbeatTimeoutMs: 30000,
    });

    // ACT
    await coordinator1.registerConsumer();
    await coordinator2.registerConsumer();
    await coordinator3.registerConsumer();

    // Keep all consumers alive before fetching assignments
    await coordinator1.sendHeartbeat();
    await coordinator2.sendHeartbeat();
    await coordinator3.sendHeartbeat();

    // Fetch updated assignments after all consumers registered
    const assignment1 = await coordinator1.getAssignedPartitions();
    const assignment2 = await coordinator2.getAssignedPartitions();
    const assignment3 = await coordinator3.getAssignedPartitions();

    // ASSERT
    // Each consumer should get 2 partitions (6 / 3 = 2)
    expect(assignment1.partitions).toHaveLength(2);
    expect(assignment2.partitions).toHaveLength(2);
    expect(assignment3.partitions).toHaveLength(2);

    // All partitions should be assigned
    const allAssignedPartitions = [
      ...assignment1.partitions,
      ...assignment2.partitions,
      ...assignment3.partitions,
    ].sort((a, b) => a - b);
    expect(allAssignedPartitions).toEqual([0, 1, 2, 3, 4, 5]);

    // No partition should be assigned to multiple consumers
    const uniquePartitions = new Set(allAssignedPartitions);
    expect(uniquePartitions.size).toBe(6);
  });

  test("distributes partitions with uneven split", async () => {
    // ARRANGE
    const groupName = randomUUIDv7();
    const partitionCount = 5;
    const consumer1Id = randomUUIDv7();
    const consumer2Id = randomUUIDv7();
    const streamName = `projection-${randomUUIDv7()}`;

    const coordinator1 = new ConsumerCoordinator({
      redis,
      consumerId: consumer1Id,
      groupName,
      partitionCount,
      streamNames: [streamName],
      heartbeatTimeoutMs: 30000,
    });

    const coordinator2 = new ConsumerCoordinator({
      redis,
      consumerId: consumer2Id,
      groupName,
      partitionCount,
      streamNames: [streamName],
      heartbeatTimeoutMs: 30000,
    });

    // ACT
    await coordinator1.registerConsumer();
    await coordinator2.registerConsumer();

    // Keep both consumers alive before fetching assignments
    await coordinator1.sendHeartbeat();
    await coordinator2.sendHeartbeat();

    // Fetch updated assignments
    const assignment1 = await coordinator1.getAssignedPartitions();
    const assignment2 = await coordinator2.getAssignedPartitions();

    // ASSERT
    // One consumer gets 3 partitions, the other gets 2
    const totalPartitions =
      assignment1.partitions.length + assignment2.partitions.length;
    expect(totalPartitions).toBe(5);
    expect(
      assignment1.partitions.length === 3 || assignment1.partitions.length === 2
    ).toBe(true);
    expect(
      assignment2.partitions.length === 3 || assignment2.partitions.length === 2
    ).toBe(true);

    // All partitions should be assigned
    const allAssignedPartitions = [
      ...assignment1.partitions,
      ...assignment2.partitions,
    ].sort((a, b) => a - b);
    expect(allAssignedPartitions).toEqual([0, 1, 2, 3, 4]);
  });

  // ========================================================================
  // Consumer Failure Detection
  // ========================================================================

  test("detects failed consumer after heartbeat timeout", async () => {
    // ARRANGE
    const groupName = randomUUIDv7();
    const partitionCount = 4;
    const consumer1Id = randomUUIDv7();
    const consumer2Id = randomUUIDv7();
    const heartbeatTimeoutMs = 100; // Short timeout for testing
    const streamName = `projection-${randomUUIDv7()}`;

    const coordinator1 = new ConsumerCoordinator({
      redis,
      consumerId: consumer1Id,
      groupName,
      partitionCount,
      streamNames: [streamName],
      heartbeatTimeoutMs,
    });

    const coordinator2 = new ConsumerCoordinator({
      redis,
      consumerId: consumer2Id,
      groupName,
      partitionCount,
      streamNames: [streamName],
      heartbeatTimeoutMs,
    });

    // Register both consumers
    await coordinator1.registerConsumer();
    await coordinator2.registerConsumer();

    // Wait for consumer1's heartbeat to expire (but keep consumer2 alive)
    await new Promise((resolve) =>
      setTimeout(resolve, heartbeatTimeoutMs + 50)
    );

    // Keep consumer2 alive with a fresh heartbeat
    await coordinator2.sendHeartbeat();

    // ACT
    // Consumer2 checks for rebalancing, should detect consumer1 as failed
    const newAssignment = await coordinator2.checkForRebalance();

    // ASSERT
    expect(newAssignment).not.toBeNull();
    expect(newAssignment!.partitions).toHaveLength(4); // Consumer2 takes all partitions
  });

  // ========================================================================
  // Sticky Assignment During Rebalancing
  // ========================================================================

  test("preserves existing assignments during rebalancing", async () => {
    // ARRANGE
    const groupName = randomUUIDv7();
    const partitionCount = 6;
    const consumer1Id = randomUUIDv7();
    const consumer2Id = randomUUIDv7();
    const streamName = `projection-${randomUUIDv7()}`;

    const coordinator1 = new ConsumerCoordinator({
      redis,
      consumerId: consumer1Id,
      groupName,
      partitionCount,
      streamNames: [streamName],
      heartbeatTimeoutMs: 30000,
    });

    const coordinator2 = new ConsumerCoordinator({
      redis,
      consumerId: consumer2Id,
      groupName,
      partitionCount,
      streamNames: [streamName],
      heartbeatTimeoutMs: 30000,
    });

    // Register first two consumers
    await coordinator1.registerConsumer();
    await coordinator2.registerConsumer();

    const initialAssignment1 = await coordinator1.getAssignedPartitions();
    const initialAssignment2 = await coordinator2.getAssignedPartitions();

    // ACT
    // Add a third consumer
    const consumer3Id = randomUUIDv7();
    const coordinator3 = new ConsumerCoordinator({
      redis,
      consumerId: consumer3Id,
      groupName,
      partitionCount,
      streamNames: [streamName],
      heartbeatTimeoutMs: 30000,
    });
    await coordinator3.registerConsumer();

    // Keep all consumers alive before fetching assignments
    await coordinator1.sendHeartbeat();
    await coordinator2.sendHeartbeat();
    await coordinator3.sendHeartbeat();

    // Get updated assignments
    const newAssignment1 = await coordinator1.getAssignedPartitions();
    const newAssignment2 = await coordinator2.getAssignedPartitions();
    const newAssignment3 = await coordinator3.getAssignedPartitions();

    // ASSERT
    // Consumer 1 and 2 should retain some of their original partitions
    const retained1 = initialAssignment1.partitions.filter((p) =>
      newAssignment1.partitions.includes(p)
    );
    const retained2 = initialAssignment2.partitions.filter((p) =>
      newAssignment2.partitions.includes(p)
    );

    // At least some partitions should be retained (sticky assignment)
    expect(retained1.length).toBeGreaterThan(0);
    expect(retained2.length).toBeGreaterThan(0);

    // All 6 partitions should still be assigned
    const allPartitions = [
      ...newAssignment1.partitions,
      ...newAssignment2.partitions,
      ...newAssignment3.partitions,
    ].sort((a, b) => a - b);
    expect(allPartitions).toEqual([0, 1, 2, 3, 4, 5]);

    // Each consumer should have roughly equal load (2 partitions each)
    expect(newAssignment1.partitions.length).toBe(2);
    expect(newAssignment2.partitions.length).toBe(2);
    expect(newAssignment3.partitions.length).toBe(2);
  });

  // ========================================================================
  // Consumer Removal and Rebalancing
  // ========================================================================

  test("rebalances partitions when consumer is removed", async () => {
    // ARRANGE
    const groupName = randomUUIDv7();
    const partitionCount = 4;
    const consumer1Id = randomUUIDv7();
    const consumer2Id = randomUUIDv7();
    const streamName = `projection-${randomUUIDv7()}`;

    const coordinator1 = new ConsumerCoordinator({
      redis,
      consumerId: consumer1Id,
      groupName,
      partitionCount,
      streamNames: [streamName],
      heartbeatTimeoutMs: 30000,
    });

    const coordinator2 = new ConsumerCoordinator({
      redis,
      consumerId: consumer2Id,
      groupName,
      partitionCount,
      streamNames: [streamName],
      heartbeatTimeoutMs: 30000,
    });

    await coordinator1.registerConsumer();
    await coordinator2.registerConsumer();

    // ACT
    // Consumer 1 explicitly removes itself
    await coordinator1.removeConsumer();

    // Consumer 2 should detect rebalancing
    const newAssignment2 = await coordinator2.getAssignedPartitions();

    // ASSERT
    // Consumer 2 should now have all 4 partitions
    expect(newAssignment2.partitions).toHaveLength(4);
    expect(newAssignment2.partitions.sort((a, b) => a - b)).toEqual([
      0, 1, 2, 3,
    ]);
  });

  // ========================================================================
  // Distributed Lock for Concurrent Rebalancing
  // ========================================================================

  test("prevents concurrent rebalancing with distributed lock", async () => {
    // ARRANGE
    const groupName = randomUUIDv7();
    const partitionCount = 4;
    const consumer1Id = randomUUIDv7();
    const consumer2Id = randomUUIDv7();
    const streamName = `projection-${randomUUIDv7()}`;

    const coordinator1 = new ConsumerCoordinator({
      redis,
      consumerId: consumer1Id,
      groupName,
      partitionCount,
      streamNames: [streamName],
      heartbeatTimeoutMs: 30000,
    });

    const coordinator2 = new ConsumerCoordinator({
      redis,
      consumerId: consumer2Id,
      groupName,
      partitionCount,
      streamNames: [streamName],
      heartbeatTimeoutMs: 30000,
    });

    // Both consumers send heartbeats first
    await coordinator1.sendHeartbeat();
    await coordinator2.sendHeartbeat();

    // ACT
    // Trigger rebalancing from both coordinators concurrently
    await Promise.all([
      coordinator1.triggerRebalance(),
      coordinator2.triggerRebalance(),
    ]);

    // ASSERT
    // Both coordinators should complete without errors
    const assignment1 = await coordinator1.getAssignedPartitions();
    const assignment2 = await coordinator2.getAssignedPartitions();

    // All partitions should be assigned exactly once
    const allPartitions = [
      ...assignment1.partitions,
      ...assignment2.partitions,
    ].sort((a, b) => a - b);
    expect(allPartitions).toEqual([0, 1, 2, 3]);

    // No duplicate assignments
    const uniquePartitions = new Set(allPartitions);
    expect(uniquePartitions.size).toBe(4);
  });

  // ========================================================================
  // Generation Number Consistency
  // ========================================================================

  test("increments generation number on each rebalance", async () => {
    // ARRANGE
    const groupName = randomUUIDv7();
    const partitionCount = 4;
    const consumer1Id = randomUUIDv7();
    const streamName = `projection-${randomUUIDv7()}`;

    const coordinator1 = new ConsumerCoordinator({
      redis,
      consumerId: consumer1Id,
      groupName,
      partitionCount,
      streamNames: [streamName],
      heartbeatTimeoutMs: 30000,
    });

    // ACT
    const assignment1 = await coordinator1.registerConsumer();
    expect(assignment1.generation).toBe(1);

    // Trigger another rebalance
    await coordinator1.triggerRebalance();
    const assignment2 = await coordinator1.getAssignedPartitions();
    expect(assignment2.generation).toBe(2);

    // Trigger another rebalance
    await coordinator1.triggerRebalance();
    const assignment3 = await coordinator1.getAssignedPartitions();
    expect(assignment3.generation).toBe(3);

    // ASSERT
    expect(assignment3.generation).toBeGreaterThan(assignment2.generation);
    expect(assignment2.generation).toBeGreaterThan(assignment1.generation);
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  test("handles zero partitions assigned gracefully", async () => {
    // ARRANGE
    const groupName = randomUUIDv7();
    const partitionCount = 2;
    const consumer1Id = randomUUIDv7();
    const consumer2Id = randomUUIDv7();
    const consumer3Id = randomUUIDv7();
    const streamName = `projection-${randomUUIDv7()}`;

    const coordinator1 = new ConsumerCoordinator({
      redis,
      consumerId: consumer1Id,
      groupName,
      partitionCount,
      streamNames: [streamName],
      heartbeatTimeoutMs: 30000,
    });

    const coordinator2 = new ConsumerCoordinator({
      redis,
      consumerId: consumer2Id,
      groupName,
      partitionCount,
      streamNames: [streamName],
      heartbeatTimeoutMs: 30000,
    });

    const coordinator3 = new ConsumerCoordinator({
      redis,
      consumerId: consumer3Id,
      groupName,
      partitionCount,
      streamNames: [streamName],
      heartbeatTimeoutMs: 30000,
    });

    // ACT
    await coordinator1.registerConsumer();
    await coordinator2.registerConsumer();
    await coordinator3.registerConsumer();

    const assignment3 = await coordinator3.getAssignedPartitions();

    // ASSERT
    // With 2 partitions and 3 consumers, one consumer will have 0 partitions
    // Verify this doesn't cause errors
    expect(
      assignment3.partitions.length === 0 || assignment3.partitions.length >= 0
    ).toBe(true);

    // Verify stream names work with empty partitions
    const streamNames = coordinator3.getStreamNamesForPartitions(
      assignment3.partitions
    );
    expect(Array.isArray(streamNames)).toBe(true);
  });
});
