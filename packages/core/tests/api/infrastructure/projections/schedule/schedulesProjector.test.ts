import { describe, test, expect } from 'bun:test'
import { SchedulesProjector } from '../../../../../src/api/infrastructure/projections/schedule/schedulesProjector'
import {
  ScheduleCreatedEvent,
  ScheduleUpdatedEvent,
  ScheduleExecutedEvent,
  ScheduleFailedEvent,
  ScheduleCancelledEvent,
  type ScheduleState,
} from '../../../../../src/api/domain/schedule/events'
import type { UnitOfWorkRepositories } from '../../../../../src/api/infrastructure/unitOfWork'

function createMockScheduleState(overrides: Partial<ScheduleState> = {}): ScheduleState {
  return {
    id: 'schedule-123',
    correlationId: 'correlation-123',
    version: 0,
    targetAggregateId: 'product-123',
    targetAggregateType: 'product',
    commandType: 'publishProduct',
    commandData: { productId: 'product-123' },
    scheduledFor: new Date(),
    status: 'pending',
    retryCount: 0,
    nextRetryAt: null,
    createdBy: 'user-123',
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function createMockRepositories(): { repositories: UnitOfWorkRepositories; savedStates: ScheduleState[] } {
  const savedStates: ScheduleState[] = []

  const mockSchedulesReadModelRepository = {
    save: (state: ScheduleState) => {
      savedStates.push(state)
    },
  }

  const repositories = {
    schedulesReadModelRepository: mockSchedulesReadModelRepository,
  } as unknown as UnitOfWorkRepositories

  return { repositories, savedStates }
}

describe('SchedulesProjector', () => {
  test('should handle schedule.created event', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new SchedulesProjector(repositories)
    const newState = createMockScheduleState({ commandType: 'publishProduct' })
    const event = new ScheduleCreatedEvent({
      occurredAt: new Date(),
      aggregateId: 'schedule-123',
      correlationId: 'correlation-123',
      version: 0,
      userId: 'user-123',
      priorState: createMockScheduleState(),
      newState,
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.commandType).toBe('publishProduct')
    expect(savedStates[0]?.status).toBe('pending')
  })

  test('should handle schedule.updated event', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new SchedulesProjector(repositories)
    const newScheduledFor = new Date(Date.now() + 86400000) // Tomorrow
    const newState = createMockScheduleState({ scheduledFor: newScheduledFor })
    const event = new ScheduleUpdatedEvent({
      occurredAt: new Date(),
      aggregateId: 'schedule-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockScheduleState(),
      newState,
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.scheduledFor).toBe(newScheduledFor)
  })

  test('should handle schedule.executed event', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new SchedulesProjector(repositories)
    const newState = createMockScheduleState({ status: 'executed' })
    const event = new ScheduleExecutedEvent({
      occurredAt: new Date(),
      aggregateId: 'schedule-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'system',
      priorState: createMockScheduleState({ status: 'pending' }),
      newState,
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.status).toBe('executed')
  })

  test('should handle schedule.failed event', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new SchedulesProjector(repositories)
    const newState = createMockScheduleState({
      status: 'failed',
      errorMessage: 'Product not found',
      retryCount: 3,
    })
    const event = new ScheduleFailedEvent({
      occurredAt: new Date(),
      aggregateId: 'schedule-123',
      correlationId: 'correlation-123',
      version: 4,
      userId: 'system',
      priorState: createMockScheduleState({ status: 'pending', retryCount: 2 }),
      newState,
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.status).toBe('failed')
    expect(savedStates[0]?.errorMessage).toBe('Product not found')
    expect(savedStates[0]?.retryCount).toBe(3)
  })

  test('should handle schedule.cancelled event', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new SchedulesProjector(repositories)
    const newState = createMockScheduleState({ status: 'cancelled' })
    const event = new ScheduleCancelledEvent({
      occurredAt: new Date(),
      aggregateId: 'schedule-123',
      correlationId: 'correlation-123',
      version: 1,
      userId: 'user-123',
      priorState: createMockScheduleState({ status: 'pending' }),
      newState,
    })

    // Act
    await projector.execute(event)

    // Assert
    expect(savedStates).toHaveLength(1)
    expect(savedStates[0]?.status).toBe('cancelled')
  })

  test('should ignore unhandled events', async () => {
    // Arrange
    const { repositories, savedStates } = createMockRepositories()
    const projector = new SchedulesProjector(repositories)

    // Create an event with a type that the projector doesn't handle
    const unknownEvent = {
      eventName: 'unknown.event',
      aggregateId: 'test-123',
      correlationId: 'correlation-123',
      version: 0,
      userId: 'user-123',
      occurredAt: new Date(),
      payload: {},
    }

    // Act
    await projector.execute(unknownEvent as any)

    // Assert - should not throw and should not save anything
    expect(savedStates).toHaveLength(0)
  })
})
