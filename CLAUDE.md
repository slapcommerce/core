# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is an e-commerce toolkit SDK implementing event-sourced Domain-Driven Design (DDD) with CQRS. The system uses Redis as an event store with Lua-based transactional semantics for atomic operations.

## Development Commands

**Build & Test:**
- `bun test` - Run all tests
- `bun test:unit` - Run unit tests in Docker container
- `bun test:live` - Run integration tests in Docker with Redis
- `bun test:multiple` - Run multiple test suites concurrently (used internally by test:live)

**Database:**
- `bun drizzle:push` - Push database schema changes

**Runtime:**
- Always use `bun` instead of `node` or `npm` (see .cursor/rules for full Bun conventions)
- Docker Compose manages Redis and test environment dependencies

## Architecture

### Layered Structure

```
src/
├── domain/          # Domain layer (aggregates, events, business logic)
├── app/             # Application layer (commands, command handlers)
├── infrastructure/  # Infrastructure layer (repositories, serialization, Redis)
├── views/           # Read models (projections)
└── api/             # API layer (response formatting)
```

### Event Sourcing

The system stores all state changes as events in Redis streams:

1. **Per-Aggregate Streams** (`RedisPrefix.EVENTS + aggregateId`): Event history for individual aggregates, used for rehydration
2. **Aggregate-Type Streams** (`RedisPrefix.AGGREGATE_TYPE + aggregateType`): All events for an aggregate type, used for projections
3. **Snapshots** (`RedisPrefix.SNAPSHOTS + aggregateType + aggregateId`): Cached aggregate state for performance

**Event Flow:**
- Commands create domain events via aggregate methods (e.g., `ProductAggregate.create()`)
- Events are stored in `uncommittedEvents` array
- `UnitOfWork.withTransaction()` persists events atomically via Lua scripts
- Events are serialized with MessagePack and optionally compressed with Zstd (>= 4KB)

### Domain Layer

**Aggregates:**
- Must define `stateFields` (readonly array of field names for serialization)
- Must define `stateVersion` (for schema evolution)
- Optional `encryptedFields` (array of fields to encrypt at rest)
- Implement `static create()` factory methods for creation
- Implement `apply(event)` for event application
- Implement `static loadFromHistory(events)` for rehydration
- Track `version` for optimistic concurrency control
- Track `events` (committed) and `uncommittedEvents` (pending)

**Domain Events:**
- Must define `payloadFields` (readonly array of field names for serialization)
- Must define `payloadVersion` (for schema evolution)
- Optional `encryptedFields` (array of fields to encrypt)
- Must be registered in `EVENT_REGISTRY` (src/infrastructure/eventSerializer.ts)
- Include: `occurredAt`, `eventName`, `correlationId`, `aggregateId`, `version`, `payload`

**Example:** See `ProductAggregate` (src/domain/product/aggregate.ts) and `ProductCreatedEvent` (src/domain/product/events.ts)

### Application Layer

**Commands:**
- Defined using Zod schemas in `src/app/*/commands.ts`
- Command handlers orchestrate aggregate operations within `UnitOfWork` transactions
- Commands trigger aggregate methods that produce domain events

### Infrastructure Layer

**Unit of Work Pattern:**
- `UnitOfWork.withTransaction()` provides transactional boundaries
- Injects repositories: `EventRepository`, `AggregateTypeRepository`, `SnapshotRepository`
- Uses `LuaCommandTransaction` for atomic Redis operations

**Repositories:**
- `EventRepository`: Writes events to per-aggregate streams
- `AggregateTypeRepository`: Writes events to aggregate-type streams
- `SnapshotRepository`: Writes/reads aggregate snapshots

**Optimistic Concurrency:**
- Lua scripts verify expected version before committing
- Version mismatches throw errors to prevent concurrent modification conflicts

**Serialization:**
- `EventSerializer`: Array-based MessagePack encoding with optional Zstd compression
- `AggregateSerializer`: Array-based MessagePack encoding with optional Zstd compression
- Compression threshold: 4KB (COMPRESSION_THRESHOLD in src/infrastructure/utils/compression.ts)
- Supports field encryption via `encryptedFields` arrays

**Lua Transactions:**
- `LuaCommandTransaction`: Command deduplication + event persistence + snapshots
- `LuaProjectionTransaction`: Projection updates with version checking
- Scripts are cached by operation signature for performance

### Projections

**Location:** `src/views/projections/`

**Pattern:**
- Use `LuaProjectionTransaction` for atomic Redis updates
- Track projection version per aggregate for idempotency
- Subscribe to aggregate-type streams to build read models
- Support multiple Redis data structures: hashes, sets, sorted sets, strings

**Example:** `ProductProjection` (src/views/projections/productProjection.ts)

## Testing Conventions

**Unit Tests** (tests/unit/):
- Run with: `bun test:unit`
- No Docker dependencies
- Test domain logic, serializers, utilities

**Integration Tests** (tests/integration/):
- Run with: `bun test:live`
- Require Docker + Redis
- Test repository operations, transactions, projections

**E2E Tests** (tests/e2e/):
- Run with: `bun test:live`
- Test full command → event → projection workflows

**Rules (from .cursor/rules):**
1. No beforeEach/afterEach/beforeAll/afterAll hooks
2. All tests must be idempotent (use unique IDs, stream names, Redis keys)
3. Use Arrange-Act-Assert pattern
4. Reference `tests/unit/infrastructure/eventSerializer.spec.ts` for unit test style
5. Reference `tests/integration/infrastructure/outboxDispatcher.spec.ts` for integration test style
6. Test happy path first, then error scenarios, then edge cases
7. Test all public methods and code paths

## Key Patterns & Practices

**Adding a New Aggregate:**
1. Create aggregate class in `src/domain/{aggregate}/aggregate.ts` with `stateFields`, `stateVersion`
2. Create events in `src/domain/{aggregate}/events.ts` with `payloadFields`, `payloadVersion`
3. Register events in `EVENT_REGISTRY` (src/infrastructure/eventSerializer.ts)
4. Register aggregate in `AGGREGATE_REGISTRY` (src/infrastructure/aggregateSerializer.ts)
5. Implement command handlers in `src/app/{aggregate}/`
6. Create projections in `src/views/projections/`

**Schema Evolution:**
- Increment `stateVersion` or `payloadVersion` when changing field arrays
- Add migration logic in deserialize methods if needed
- Old events/snapshots can be deserialized by array index

**Encryption:**
- Set `ENCRYPTION_KEY` environment variable (base64-encoded 32-byte key)
- Add field names to `encryptedFields` array in aggregate/event classes
- Encryption happens automatically during serialization

**Compression:**
- Automatic for payloads >= 4KB
- Uses Zstd level 1 for speed
- Detected via magic bytes during deserialization

## Environment Variables

- `REDIS_URL`: Redis connection string (default: redis://redis:6379)
- `ENCRYPTION_KEY`: Base64-encoded 32-byte key for field encryption

## Docker Setup

**Local Development:**
```bash
docker compose up -d redis        # Start Redis
bun test:live                     # Run integration tests
```

The docker-compose.yaml defines services:
- `core`: Application container with Bun runtime
- `redis`: Redis 7.x for event store and projections
