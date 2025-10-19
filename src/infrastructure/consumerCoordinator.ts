import type { RedisClient } from "./redis";

type ConsumerCoordinatorProps = {
  redis: RedisClient;
  consumerId: string;
  groupName: string;
  partitionCount: number;
  streamNames: string[];
  heartbeatTimeoutMs: number;
};

type PartitionAssignment = {
  generation: number;
  partitions: number[];
};

/**
 * ConsumerCoordinator manages automatic partition assignment and rebalancing
 * for Redis stream consumers using Redis as the coordination layer.
 *
 * Key responsibilities:
 * - Register consumers and maintain heartbeats
 * - Detect failed consumers (heartbeat timeout)
 * - Coordinate partition assignment with sticky rebalancing
 * - Handle consumer join/leave events
 *
 * Redis data structures:
 * - consumer:heartbeats:{groupName} -> Sorted Set {consumerId: timestamp}
 * - consumer:assignments:{groupName} -> Hash {partitionId: consumerId}
 * - consumer:generation:{groupName} -> String (monotonic counter)
 * - consumer:rebalance-lock:{groupName} -> String (distributed lock)
 */
export class ConsumerCoordinator {
  private redis: RedisClient;
  private consumerId: string;
  private groupName: string;
  private partitionCount: number;
  private streamNames: string[];
  private heartbeatTimeoutMs: number;
  private currentGeneration: number = 0;
  private currentPartitions: number[] = [];

  // Redis key patterns
  private readonly heartbeatsKey: string;
  private readonly assignmentsKey: string;
  private readonly generationKey: string;
  private readonly rebalanceLockKey: string;

  constructor({
    redis,
    consumerId,
    groupName,
    partitionCount,
    streamNames,
    heartbeatTimeoutMs,
  }: ConsumerCoordinatorProps) {
    this.redis = redis;
    this.consumerId = consumerId;
    this.groupName = groupName;
    this.partitionCount = partitionCount;
    this.streamNames = streamNames;
    this.heartbeatTimeoutMs = heartbeatTimeoutMs;

    // Initialize Redis keys
    this.heartbeatsKey = `consumer:heartbeats:${groupName}`;
    this.assignmentsKey = `consumer:assignments:${groupName}`;
    this.generationKey = `consumer:generation:${groupName}`;
    this.rebalanceLockKey = `consumer:rebalance-lock:${groupName}`;
  }

  /**
   * Register this consumer and get initial partition assignments.
   * Triggers rebalancing if needed.
   */
  async registerConsumer(): Promise<PartitionAssignment> {
    console.log(`ConsumerCoordinator: Registering consumer ${this.consumerId}`);

    // Send initial heartbeat
    await this.sendHeartbeat();

    // Trigger rebalancing to get partition assignments
    await this.triggerRebalance();

    // Fetch assigned partitions
    return await this.getAssignedPartitions();
  }

  /**
   * Send heartbeat to indicate this consumer is alive.
   */
  async sendHeartbeat(): Promise<void> {
    const now = Date.now();
    await this.redis.zadd(this.heartbeatsKey, now, this.consumerId);
  }

  /**
   * Get current partition assignments for this consumer.
   */
  async getAssignedPartitions(): Promise<PartitionAssignment> {
    const generation = await this.getGeneration();
    const partitions: number[] = [];

    // Read all partition assignments
    const assignments = await this.redis.hgetall(this.assignmentsKey);

    for (const [partitionId, assignedConsumerId] of Object.entries(
      assignments
    )) {
      if (assignedConsumerId === this.consumerId) {
        partitions.push(parseInt(partitionId, 10));
      }
    }

    this.currentGeneration = generation;
    this.currentPartitions = partitions.sort((a, b) => a - b);

    return {
      generation,
      partitions: this.currentPartitions,
    };
  }

  /**
   * Check if rebalancing is needed and get updated assignments.
   * Returns null if no rebalancing occurred.
   */
  async checkForRebalance(): Promise<PartitionAssignment | null> {
    const generation = await this.getGeneration();

    // If generation changed, fetch new assignments
    if (generation !== this.currentGeneration) {
      console.log(
        `ConsumerCoordinator: Generation changed from ${this.currentGeneration} to ${generation}, fetching new assignments`
      );
      return await this.getAssignedPartitions();
    }

    // Check for failed consumers and trigger rebalance if needed
    const activeConsumers = await this.getActiveConsumers();
    const allAssignedConsumers = await this.getAllAssignedConsumers();

    // Check if any assigned consumers are no longer active
    const hasFailedConsumers = allAssignedConsumers.some(
      (consumerId) => !activeConsumers.includes(consumerId)
    );

    if (hasFailedConsumers) {
      console.log(
        `ConsumerCoordinator: Detected failed consumers, triggering rebalance`
      );
      await this.triggerRebalance();
      return await this.getAssignedPartitions();
    }

    return null;
  }

  /**
   * Remove this consumer and trigger rebalancing.
   */
  async removeConsumer(): Promise<void> {
    console.log(`ConsumerCoordinator: Removing consumer ${this.consumerId}`);

    // Remove heartbeat
    await this.redis.zrem(this.heartbeatsKey, this.consumerId);

    // Trigger rebalancing to reassign this consumer's partitions
    await this.triggerRebalance();
  }

  /**
   * Trigger rebalancing across all consumers.
   * Uses distributed lock to ensure only one rebalance happens at a time.
   */
  async triggerRebalance(): Promise<void> {
    const lockTimeoutMs = 5000;
    const lockAcquired = await this.acquireLock(lockTimeoutMs);

    if (!lockAcquired) {
      console.log(
        `ConsumerCoordinator: Could not acquire rebalance lock, skipping`
      );
      return;
    }

    try {
      await this.performRebalance();
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * Perform the actual rebalancing logic.
   */
  private async performRebalance(): Promise<void> {
    console.log(`ConsumerCoordinator: Starting rebalance`);

    // Get active consumers
    const activeConsumers = await this.getActiveConsumers();

    if (activeConsumers.length === 0) {
      console.log(
        `ConsumerCoordinator: No active consumers, skipping rebalance`
      );
      return;
    }

    // Get current assignments
    const currentAssignments = await this.redis.hgetall(this.assignmentsKey);

    // Calculate new assignments using sticky algorithm
    const newAssignments = this.calculateStickyAssignments(
      activeConsumers,
      currentAssignments
    );

    // Update assignments in Redis
    const pipeline = this.redis.pipeline();
    pipeline.del(this.assignmentsKey);
    for (const [partitionId, consumerId] of Object.entries(newAssignments)) {
      pipeline.hset(this.assignmentsKey, partitionId, consumerId);
    }
    await pipeline.exec();

    // Increment generation
    await this.redis.incr(this.generationKey);

    console.log(
      `ConsumerCoordinator: Rebalance complete, assigned ${
        Object.keys(newAssignments).length
      } partitions to ${activeConsumers.length} consumers`
    );
  }

  /**
   * Calculate partition assignments using sticky algorithm.
   * Preserves existing assignments where possible, but ensures balanced distribution.
   */
  private calculateStickyAssignments(
    activeConsumers: string[],
    currentAssignments: Record<string, string>
  ): Record<string, string> {
    const newAssignments: Record<string, string> = {};
    const consumerPartitions = new Map<string, number[]>();

    // Initialize partition arrays for each consumer
    for (const consumerId of activeConsumers) {
      consumerPartitions.set(consumerId, []);
    }

    // Calculate target partition count per consumer
    const targetCount = Math.floor(
      this.partitionCount / activeConsumers.length
    );
    const remainder = this.partitionCount % activeConsumers.length;

    // Phase 1: Collect existing assignments for active consumers (up to target)
    const unassignedPartitions: number[] = [];
    let consumersWithExtra = 0; // Track how many consumers get extra partition

    for (
      let partitionId = 0;
      partitionId < this.partitionCount;
      partitionId++
    ) {
      const currentConsumer = currentAssignments[partitionId.toString()];

      if (currentConsumer && activeConsumers.includes(currentConsumer)) {
        const currentConsumerPartitions =
          consumerPartitions.get(currentConsumer);

        if (currentConsumerPartitions) {
          const currentCount = currentConsumerPartitions.length;

          // Can keep if under target, or exactly at target and we need more consumers with extra
          if (
            currentCount < targetCount ||
            (currentCount === targetCount && consumersWithExtra < remainder)
          ) {
            // Keep existing assignment
            currentConsumerPartitions.push(partitionId);
            newAssignments[partitionId.toString()] = currentConsumer;

            if (currentCount === targetCount) {
              consumersWithExtra++;
            }
          } else {
            // Partition needs to be reassigned (consumer has enough)
            unassignedPartitions.push(partitionId);
          }
        } else {
          // Partition needs to be reassigned (consumer not in map, shouldn't happen)
          unassignedPartitions.push(partitionId);
        }
      } else {
        // Partition needs to be reassigned (consumer not active or not assigned)
        unassignedPartitions.push(partitionId);
      }
    }

    // Phase 2: Assign unassigned partitions to under-loaded consumers
    // Sort consumers by partition count (ascending) for balanced assignment
    const sortedConsumers = Array.from(activeConsumers).sort((a, b) => {
      const partitionsA = consumerPartitions.get(a);
      const partitionsB = consumerPartitions.get(b);
      const countA = partitionsA ? partitionsA.length : 0;
      const countB = partitionsB ? partitionsB.length : 0;
      return countA - countB;
    });

    let consumerIndex = 0;
    let consumersAssignedExtra = consumersWithExtra;

    for (const partitionId of unassignedPartitions) {
      // Find next consumer that can take more partitions
      while (true) {
        const consumerId = sortedConsumers[consumerIndex];

        if (!consumerId) {
          // Should never happen with modulo arithmetic
          break;
        }

        const consumerPartitionsList = consumerPartitions.get(consumerId);

        if (!consumerPartitionsList) {
          // Should never happen since we initialized all active consumers
          consumerIndex = (consumerIndex + 1) % sortedConsumers.length;
          continue;
        }

        const currentCount = consumerPartitionsList.length;

        // Max partitions this consumer can have
        const maxForConsumer =
          targetCount + (consumersAssignedExtra < remainder ? 1 : 0);

        if (currentCount < maxForConsumer) {
          // This consumer can take another partition
          consumerPartitionsList.push(partitionId);
          newAssignments[partitionId.toString()] = consumerId;

          // If we just gave this consumer their extra partition
          if (currentCount + 1 === targetCount + 1 && remainder > 0) {
            consumersAssignedExtra++;
          }

          break;
        }

        // Move to next consumer
        consumerIndex = (consumerIndex + 1) % sortedConsumers.length;
      }

      // Move to next consumer for next partition (round-robin)
      consumerIndex = (consumerIndex + 1) % sortedConsumers.length;
    }

    return newAssignments;
  }

  /**
   * Get list of active consumers based on heartbeat timeout.
   */
  private async getActiveConsumers(): Promise<string[]> {
    const now = Date.now();
    const cutoff = now - this.heartbeatTimeoutMs;

    // Get consumers with heartbeat after cutoff
    const activeConsumers = await this.redis.zrangebyscore(
      this.heartbeatsKey,
      cutoff,
      "+inf"
    );

    return activeConsumers;
  }

  /**
   * Get list of all consumers that have partition assignments.
   */
  private async getAllAssignedConsumers(): Promise<string[]> {
    const assignments = await this.redis.hgetall(this.assignmentsKey);
    const consumers = new Set<string>(Object.values(assignments));
    return Array.from(consumers);
  }

  /**
   * Get current generation number.
   */
  private async getGeneration(): Promise<number> {
    const generation = await this.redis.get(this.generationKey);
    return generation ? parseInt(generation, 10) : 0;
  }

  /**
   * Acquire distributed lock for rebalancing.
   */
  private async acquireLock(timeoutMs: number): Promise<boolean> {
    const result = await this.redis.set(
      this.rebalanceLockKey,
      this.consumerId,
      "PX",
      timeoutMs,
      "NX"
    );
    return result === "OK";
  }

  /**
   * Release distributed lock.
   */
  private async releaseLock(): Promise<void> {
    // Only release if this consumer holds the lock
    const lockHolder = await this.redis.get(this.rebalanceLockKey);
    if (lockHolder === this.consumerId) {
      await this.redis.del(this.rebalanceLockKey);
    }
  }

  /**
   * Get full stream names for assigned partitions.
   */
  getStreamNamesForPartitions(partitions: number[]): string[] {
    const streamNames: string[] = [];
    for (const streamName of this.streamNames) {
      for (const partition of partitions) {
        streamNames.push(`${streamName}:${partition}`);
      }
    }
    return streamNames;
  }
}
