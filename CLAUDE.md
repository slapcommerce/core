# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a full-stack ecommerce application built with Bun, React, and TypeScript. The backend implements event sourcing and CQRS patterns using Domain-Driven Design principles. The frontend is a React SPA using TanStack Router and React Query.

## Commands

### Development
- `bun dev` - Start development server with hot reloading
- `bun start` - Start production server
- `bun run build` - Build frontend for production

### Testing
- `bun test` - Run all tests
- `bun test --concurrent` - Run tests in parallel (recommended)
- `bun test <file>` - Run specific test file

## Architecture

### Backend: Event Sourcing with CQRS

The backend follows a layered architecture with clear separation of concerns:

**Domain Layer** (`src/domain/`)
- Contains aggregates that manage state through event sourcing
- Each aggregate (ProductAggregate, VariantAggregate, CollectionAggregate) extends from base classes
- Aggregates emit domain events for state changes
- Events are immutable records with structure: `{ occurredAt, eventName, correlationId, aggregateId, version, payload }`
- State changes captured via `toState()` method that returns prior and new state

**Application Layer** (`src/app/`)
- Commands defined with Zod schemas for validation
- Services orchestrate domain operations (e.g., `createProductService`)
- Commands follow pattern: `{ id, correlationId, ...payload }`

**Infrastructure Layer** (`src/infrastructure/`)
- `UnitOfWork` - Coordinates transactions across repositories
- `TransactionBatcher` - Batches database writes for performance (50ms flush interval)
- Repositories handle persistence (EventRepository, SnapshotRepository, etc.)
- Routers dispatch commands/queries to appropriate services

**Views Layer** (`src/views/`)
- Read model projections that denormalize data from events
- Projections registered in ProjectionService (`src/index.ts:145-204`)
- Examples: `productListViewProjection`, `productVariantProjection`

**API Layer**
- Main entry point is `src/index.ts` with `Slap` class
- Admin endpoints require authentication via Better Auth
- Public endpoints at `/api/commands` and `/api/queries`
- Admin endpoints at `/admin/api/commands` and `/admin/api/queries`
- All requests use `{ type, payload }` or `{ type, params }` format

### Event Sourcing Flow

1. Command arrives via API endpoint
2. Application service loads aggregate from repository (rehydrates from events)
3. Business logic executes on aggregate, generating domain events
4. Events stored in `uncommittedEvents[]` array
5. UnitOfWork persists events and snapshots in transaction
6. TransactionBatcher flushes to SQLite (batched for performance)
7. ProjectionService updates read models from events

### Key Patterns

- **Event Replay**: Aggregates reconstructed via `loadFromSnapshot()` + `apply(event)`
- **Optimistic Concurrency**: Each event increments aggregate version
- **Transaction Batching**: TransactionBatcher queues writes, flushes every 50ms or 100 batches
- **Projection Handlers**: Functions that update read models from domain events
- **Better Auth**: Authentication library handling sessions and user management

## Database

Uses SQLite with `bun:sqlite` (native Bun client). The TransactionBatcher optimizes writes by:
- Batching multiple transactions into one BEGIN/COMMIT cycle
- Reducing WAL checkpoint operations
- Trading latency (max 50ms delay) for higher throughput

## Testing Conventions

### Critical Rules
1. **No test hooks**: Do not use beforeEach, afterEach, beforeAll, or afterAll
2. **Idempotent tests**: Use unique IDs per test to avoid conflicts
3. **Arrange-Act-Assert pattern**: Structure all tests with clear AAA sections
4. **Test public methods**: Focus on testing public APIs and all code paths
5. **Concurrent execution**: Tests run in parallel via `bun test --concurrent`
6. **Reference style**: See `tests/infrastructure/transactionBatcher.test.ts` for examples

Example test pattern:
```typescript
test("should create product", () => {
  // Arrange
  const productId = uuidv7()
  const correlationId = uuidv7()

  // Act
  const product = ProductAggregate.create({ id: productId, correlationId, ... })

  // Assert
  expect(product.id).toBe(productId)
  expect(product.uncommittedEvents).toHaveLength(1)
})
```

## Development Preferences

### Use Bun APIs
- `Bun.serve()` instead of Express (supports WebSockets, routes)
- `bun:sqlite` instead of better-sqlite3
- `Bun.file` instead of node:fs readFile/writeFile
- `Bun.$` for shell commands instead of execa
- WebSocket is built-in (don't use `ws` package)
- Bun automatically loads .env files (no dotenv needed)

### Frontend
- React 19 with TanStack Router for routing
- TanStack Query for data fetching and caching
- Radix UI components with Tailwind CSS
- Better Auth for authentication
- HTML imports in Bun.serve() (no Vite needed)

## Adding New Features

### Creating a New Aggregate

1. Define domain events in `src/domain/<aggregate>/events.ts`
2. Create aggregate class in `src/domain/<aggregate>/aggregate.ts`
   - Implement `static create()` factory method
   - Implement `apply(event)` to handle state changes
   - Implement `static loadFromSnapshot(snapshot)` for rehydration
   - Implement `toSnapshot()` for persistence
3. Define commands in `src/app/<aggregate>/commands.ts` with Zod schemas
4. Create service functions to handle commands
5. Add command routing in `src/infrastructure/routers/`
6. Create projection handler in `src/views/<aggregate>/`
7. Register projection handlers in `src/index.ts` ProjectionService setup

### Adding a New Command

1. Define Zod schema in `src/app/<aggregate>/commands.ts`
2. Create service function in `src/app/<aggregate>/<commandName>Service.ts`
3. Add routing in `src/infrastructure/routers/adminCommandsRouter.ts` or `publicCommandsRouter.ts`
4. Register any new event handlers in `src/index.ts` ProjectionService

## Image Storage

The application supports two image storage backends:
- **Local** (default): Images stored in `./storage/images/` directory
- **S3**: Images stored in AWS S3 bucket

Set via `IMAGE_STORAGE_TYPE` environment variable ("local" or "s3").

Images are processed through ImageOptimizer (Sharp) to generate multiple sizes and formats (WebP, AVIF).

## Environment Variables

Key environment variables:
- `NODE_ENV` - "development" or "production"
- `BETTER_AUTH_URL` - Base URL for Better Auth (default: http://localhost:3000)
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` - Admin user credentials (auto-seeded)
- `IMAGE_STORAGE_TYPE` - "local" or "s3"
