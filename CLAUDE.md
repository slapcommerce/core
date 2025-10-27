# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is `@slapcommerce/core`, an ecommerce toolkit SDK built with Bun and TypeScript. The codebase implements event sourcing and CQRS patterns using Domain-Driven Design principles.

## Commands

### Testing
- `bun test` - Run all tests

### Runtime
- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Bun automatically loads .env files (no dotenv needed)

## Architecture

### Layered Architecture (Clean Architecture)
The codebase is organized into distinct layers with clear separation of concerns:

**Domain Layer** (`src/domain/`)
- Contains aggregates, domain events, and business logic
- Aggregates extend from base classes in `src/domain/_base/`
- Each aggregate (e.g., ProductAggregate) manages its own state through event sourcing
- Domain events are immutable records of what happened in the system

**Application Layer** (`src/app/`)
- Contains commands and application services
- Commands are validated using Zod schemas
- Services orchestrate domain operations and coordinate with infrastructure

**Infrastructure Layer** (`src/infrastructure/`)
- Contains adapters for external systems (SQLite, Redis)
- SqliteAdapter supports both `bun:sqlite` and `@libsql/client`
- Repositories handle persistence of aggregates and events

**API Layer** (`src/api/`)
- Entry points for external interactions
- Uses Result type pattern (Success/Failure) for error handling
- Coordinates application services and returns typed responses

**Views Layer** (`src/views/`)
- Contains read model projections
- Projections update denormalized views from domain events

### Event Sourcing Pattern
- Aggregates are rehydrated from event history via `loadFromHistory()`
- New events are tracked in `uncommittedEvents[]` before persistence
- Each event increments the aggregate version for optimistic concurrency
- Events follow the structure: `{ occurredAt, eventName, correlationId, aggregateId, version, payload }`

### Key Design Patterns
- **Result Type**: API responses use `Result<T, E>` with `ok()` and `fail()` helpers (`src/api/response.ts`)
- **Aggregate Root**: All domain aggregates extend `DomainAggregate` base class
- **Event Replay**: Aggregates can be reconstructed from their event stream
- **Zod Validation**: Commands are validated with Zod schemas before execution

## Database

The project uses SQLite with two client options:
- `bun:sqlite` - Native Bun SQLite (preferred for local development)
- `@libsql/client` - LibSQL client (for Turso and remote databases)

Both clients are abstracted through `SqliteAdapter` which provides:
- `query<T>(sql, params)` - Execute SELECT queries
- `execute(sql, params)` - Execute INSERT/UPDATE/DELETE
- `prepare(sql)` - Create prepared statements
- `transaction(callback)` - Run operations in a transaction

WAL mode is automatically enabled for both clients.

## Testing Conventions

### Critical Rules
1. **No test hooks**: Do not use beforeEach, afterEach, beforeAll, or afterAll
2. **Idempotent tests**: All tests must use unique IDs and resources to avoid conflicts
3. **Arrange-Act-Assert pattern**: Structure all tests with clear AAA sections
4. **Test public methods**: Focus on testing public APIs and all code paths
5. **Test order**: Happy path → error scenarios → edge cases

## Development Preferences

### Use Bun APIs over alternatives:
- `Bun.serve()` instead of Express (supports WebSockets, HTTPS, routes)
- `bun:sqlite` instead of better-sqlite3
- `Bun.file` instead of node:fs readFile/writeFile
- `Bun.$` for shell commands instead of execa
- WebSocket is built-in (don't use `ws` package)

### TypeScript Configuration
- Target: ESNext with bundler module resolution
- Strict mode enabled with additional strictness flags
- No emitting (Bun handles transpilation)
- JSX: react-jsx for React support

## Adding New Features

### Creating a New Aggregate
1. Define domain events in `src/domain/<aggregate>/events.ts`
2. Create aggregate class in `src/domain/<aggregate>/aggregate.ts`
   - Implement `static create()` factory method
   - Implement `apply(event)` to handle state changes
   - Implement `static loadFromHistory(events)` for rehydration
3. Define commands in `src/app/<aggregate>/commands.ts` with Zod schemas
4. Create application service to handle commands
5. Add API endpoint in `src/api/<aggregate>/index.ts`

### Event Sourcing Flow
1. Command comes in through API layer
2. Application service loads aggregate from repository (rehydrates from events)
3. Business logic executes on aggregate, generating new domain events
4. Events stored in `uncommittedEvents[]`
5. Repository persists events and updates projections
6. Result returned to API caller

## Recent Changes

The project recently migrated from Redis-based infrastructure to SQLite (commit: afc1916). Some infrastructure files referenced in the codebase may be in-progress or incomplete.
