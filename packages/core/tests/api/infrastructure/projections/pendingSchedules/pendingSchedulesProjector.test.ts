import { describe, test, expect } from 'bun:test'
import { PendingSchedulesProjector } from '../../../../../src/api/infrastructure/projections/pendingSchedules/pendingSchedulesProjector'
import {
  DropshipVariantSaleScheduledEvent,
  DropshipVariantScheduledSaleStartedEvent,
  DropshipVariantScheduledSaleEndedEvent,
  DropshipVariantScheduledSaleUpdatedEvent,
  DropshipVariantScheduledSaleCancelledEvent,
  type DropshipVariantState,
} from '../../../../../src/api/domain/dropshipVariant/events'
import { ImageCollection } from '../../../../../src/api/domain/_base/imageCollection'
import type { UnitOfWorkRepositories } from '../../../../../src/api/infrastructure/unitOfWork'
import type { PendingScheduleRecord, PendingScheduleStatus } from '../../../../../src/api/infrastructure/repositories/readModels/pendingSchedulesReadModelRepository'

function createMockVariantState(overrides: Partial<DropshipVariantState> = {}): DropshipVariantState {
  return {
    variantType: 'dropship',
    productId: 'product-123',
    sku: 'SKU-001',
    listPrice: 29.99,
    saleType: null,
    saleValue: null,
    inventory: 100,
    options: {},
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: new Date(),
    images: ImageCollection.empty(),
    fulfillmentProviderId: 'provider-123',
    supplierCost: 10.00,
    supplierSku: 'SUP-001',
    saleSchedule: null,
    dropSchedule: null,
    ...overrides,
  }
}

function createMockSaleScheduleState(overrides: Record<string, unknown> = {}) {
  return {
    id: 'schedule-123',
    scheduleGroupId: 'group-123',
    startScheduleId: 'start-schedule-123',
    endScheduleId: 'end-schedule-123',
    status: 'pending' as const,
    startDate: new Date(Date.now() + 86400000),
    endDate: new Date(Date.now() + 172800000),
    saleType: 'percent' as const,
    saleValue: 0.2,
    createdAt: new Date(),
    createdBy: 'user-123',
    ...overrides,
  }
}

function createMockRepositories(): {
  repositories: UnitOfWorkRepositories;
  savedRecords: PendingScheduleRecord[];
  updatedStatuses: Array<{ scheduleId: string; status: PendingScheduleStatus }>;
  deletedGroupIds: string[];
} {
  const savedRecords: PendingScheduleRecord[] = []
  const updatedStatuses: Array<{ scheduleId: string; status: PendingScheduleStatus }> = []
  const deletedGroupIds: string[] = []

  const mockRepository = {
    save: (record: PendingScheduleRecord) => {
      savedRecords.push(record)
    },
    updateStatus: (scheduleId: string, status: PendingScheduleStatus) => {
      updatedStatuses.push({ scheduleId, status })
    },
    deleteByGroupId: (groupId: string) => {
      deletedGroupIds.push(groupId)
    },
  }

  const repositories = {
    pendingSchedulesReadModelRepository: mockRepository,
  } as unknown as UnitOfWorkRepositories

  return { repositories, savedRecords, updatedStatuses, deletedGroupIds }
}

describe('PendingSchedulesProjector', () => {
  describe('handleSaleScheduled', () => {
    test('should create two pending schedule records when sale is scheduled', async () => {
      const { repositories, savedRecords } = createMockRepositories()
      const projector = new PendingSchedulesProjector(repositories)

      const saleSchedule = createMockSaleScheduleState()
      const newState = createMockVariantState({ saleSchedule })

      const event = new DropshipVariantSaleScheduledEvent({
        occurredAt: new Date(),
        correlationId: 'corr-123',
        aggregateId: 'variant-123',
        version: 1,
        userId: 'user-123',
        priorState: createMockVariantState(),
        newState,
      })

      await projector.execute(event)

      expect(savedRecords).toHaveLength(2)

      // Check sale_start record
      const startRecord = savedRecords.find(r => r.scheduleType === 'sale_start')
      expect(startRecord).toBeDefined()
      expect(startRecord!.scheduleId).toBe('start-schedule-123')
      expect(startRecord!.scheduleGroupId).toBe('group-123')
      expect(startRecord!.aggregateId).toBe('variant-123')
      expect(startRecord!.aggregateType).toBe('dropship_variant')
      expect(startRecord!.status).toBe('pending')
      expect(startRecord!.metadata).toEqual({ saleType: 'percent', saleValue: 0.2 })

      // Check sale_end record
      const endRecord = savedRecords.find(r => r.scheduleType === 'sale_end')
      expect(endRecord).toBeDefined()
      expect(endRecord!.scheduleId).toBe('end-schedule-123')
      expect(endRecord!.scheduleGroupId).toBe('group-123')
      expect(endRecord!.metadata).toBeNull()
    })
  })

  describe('handleScheduledSaleStarted', () => {
    test('should mark start schedule as completed when sale is started', async () => {
      const { repositories, updatedStatuses } = createMockRepositories()
      const projector = new PendingSchedulesProjector(repositories)

      const saleSchedule = createMockSaleScheduleState({ status: 'active' })
      const newState = createMockVariantState({
        saleSchedule,
        saleType: 'percent',
        saleValue: 0.2,
      })

      const event = new DropshipVariantScheduledSaleStartedEvent({
        occurredAt: new Date(),
        correlationId: 'corr-123',
        aggregateId: 'variant-123',
        version: 2,
        userId: 'system',
        priorState: createMockVariantState({ saleSchedule: createMockSaleScheduleState() }),
        newState,
      })

      await projector.execute(event)

      expect(updatedStatuses).toHaveLength(1)
      expect(updatedStatuses[0]!.scheduleId).toBe('start-schedule-123')
      expect(updatedStatuses[0]!.status).toBe('completed')
    })
  })

  describe('handleScheduledSaleEnded', () => {
    test('should mark end schedule as completed when sale ends', async () => {
      const { repositories, updatedStatuses } = createMockRepositories()
      const projector = new PendingSchedulesProjector(repositories)

      const saleSchedule = createMockSaleScheduleState({ status: 'completed' })
      const newState = createMockVariantState({ saleSchedule })

      const event = new DropshipVariantScheduledSaleEndedEvent({
        occurredAt: new Date(),
        correlationId: 'corr-123',
        aggregateId: 'variant-123',
        version: 3,
        userId: 'system',
        priorState: createMockVariantState({
          saleSchedule: createMockSaleScheduleState({ status: 'active' }),
          saleType: 'percent',
          saleValue: 0.2,
        }),
        newState,
      })

      await projector.execute(event)

      expect(updatedStatuses).toHaveLength(1)
      expect(updatedStatuses[0]!.scheduleId).toBe('end-schedule-123')
      expect(updatedStatuses[0]!.status).toBe('completed')
    })
  })

  describe('handleScheduledSaleUpdated', () => {
    test('should update both schedule records when dates change', async () => {
      const { repositories, savedRecords } = createMockRepositories()
      const projector = new PendingSchedulesProjector(repositories)

      const priorSchedule = createMockSaleScheduleState()
      const newSchedule = createMockSaleScheduleState({
        startDate: new Date(Date.now() + 100000000),
        endDate: new Date(Date.now() + 200000000),
      })

      const event = new DropshipVariantScheduledSaleUpdatedEvent({
        occurredAt: new Date(),
        correlationId: 'corr-123',
        aggregateId: 'variant-123',
        version: 2,
        userId: 'user-123',
        priorState: createMockVariantState({ saleSchedule: priorSchedule }),
        newState: createMockVariantState({ saleSchedule: newSchedule }),
      })

      await projector.execute(event)

      // Both start and end schedules should be saved with new dates
      expect(savedRecords).toHaveLength(2)
    })

    test('should not update start schedule when already active', async () => {
      const { repositories, savedRecords } = createMockRepositories()
      const projector = new PendingSchedulesProjector(repositories)

      const priorSchedule = createMockSaleScheduleState({ status: 'active' })
      const newSchedule = createMockSaleScheduleState({
        status: 'active',
        endDate: new Date(Date.now() + 200000000),
      })

      const event = new DropshipVariantScheduledSaleUpdatedEvent({
        occurredAt: new Date(),
        correlationId: 'corr-123',
        aggregateId: 'variant-123',
        version: 2,
        userId: 'user-123',
        priorState: createMockVariantState({ saleSchedule: priorSchedule, saleType: 'percent', saleValue: 0.2 }),
        newState: createMockVariantState({ saleSchedule: newSchedule, saleType: 'percent', saleValue: 0.2 }),
      })

      await projector.execute(event)

      // Only end schedule should be updated (start can't be modified when active)
      expect(savedRecords).toHaveLength(1)
      expect(savedRecords[0]!.scheduleType).toBe('sale_end')
    })
  })

  describe('handleScheduledSaleCancelled', () => {
    test('should delete both schedule records when sale is cancelled', async () => {
      const { repositories, deletedGroupIds } = createMockRepositories()
      const projector = new PendingSchedulesProjector(repositories)

      const saleSchedule = createMockSaleScheduleState({ status: 'cancelled' })
      const newState = createMockVariantState({ saleSchedule })

      const event = new DropshipVariantScheduledSaleCancelledEvent({
        occurredAt: new Date(),
        correlationId: 'corr-123',
        aggregateId: 'variant-123',
        version: 2,
        userId: 'user-123',
        priorState: createMockVariantState({ saleSchedule: createMockSaleScheduleState() }),
        newState,
      })

      await projector.execute(event)

      expect(deletedGroupIds).toHaveLength(1)
      expect(deletedGroupIds[0]).toBe('group-123')
    })
  })

  describe('event routing', () => {
    test('should ignore events that are not sale schedule events', async () => {
      const { repositories, savedRecords, updatedStatuses, deletedGroupIds } = createMockRepositories()
      const projector = new PendingSchedulesProjector(repositories)

      // Create a mock event with unhandled event name
      const mockEvent = {
        eventName: 'some_other_event',
        payload: {},
      } as any

      await projector.execute(mockEvent)

      expect(savedRecords).toHaveLength(0)
      expect(updatedStatuses).toHaveLength(0)
      expect(deletedGroupIds).toHaveLength(0)
    })
  })
})
