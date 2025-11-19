# GEMINI.md

This file provides context and instructions for Gemini when working with this codebase.

## Project Overview

This is a full-stack ecommerce application built with **Bun**, **React 19**, and **TypeScript**. It implements **Event Sourcing** and **CQRS** (Command Query Responsibility Segregation) patterns using **Domain-Driven Design (DDD)** principles.

### Tech Stack

*   **Runtime:** Bun (v1.3.2+)
*   **Frontend:** React 19, TanStack Router, TanStack Query, Tailwind CSS, Shadcn UI, Radix UI.
*   **Backend:** Bun (native HTTP server), Better Auth.
*   **Database:** SQLite (via `bun:sqlite`), with a custom `TransactionBatcher` for performance.
*   **Image Processing:** Sharp (supports Local and S3 storage).

## Architecture

The system is strictly layered to support Event Sourcing and CQRS:

1.  **Domain Layer** (`src/domain/`)
    *   Contains **Aggregates** (e.g., `ProductAggregate`, `CollectionAggregate`) that manage state via events.
    *   **Events** are immutable facts (`occurredAt`, `eventName`, `payload`).
    *   State changes are captured by `apply(event)` and `toState()` methods.

2.  **Application Layer** (`src/app/`)
    *   **Commands** defined with Zod schemas.
    *   **Services** orchestrate domain operations (load aggregate -> execute logic -> save events).

3.  **Infrastructure Layer** (`src/infrastructure/`)
    *   **UnitOfWork**: Coordinates transactions.
    *   **TransactionBatcher**: Batches writes to SQLite (50ms flush interval) for high throughput.
    *   **Repositories**: Handle persistence of events and snapshots.
    *   **Routers**: Map HTTP requests to services.

4.  **Views Layer** (`src/views/`)
    *   **Projections**: Read models denormalized from domain events.
    *   Registered in `ProjectionService` (`src/index.ts`).

## Development Workflow

### Breaking Changes
Don't worry about breaking changes. This project is in active development.
We will never need backwards compatability.

### Key Commands

*   **Start Dev Server:** `bun dev` (Hot reloading enabled)
*   **Start Production:** `bun start`
*   **Build Frontend:** `bun run build`
*   **Run Tests:** `bun test` (Runs all tests)
*   **Run Tests Concurrently:** `bun test --concurrent` (Recommended)

### Coding Conventions

*   **Bun First:** Use Bun APIs over Node.js equivalents.
    *   `Bun.serve()` instead of Express.
    *   `bun:sqlite` instead of `better-sqlite3`.
    *   `Bun.file` instead of `fs`.
    *   `Bun.$` for shell commands.
*   **No Dotenv:** Bun loads `.env` automatically.
*   **Frontend Imports:** Use HTML imports with `Bun.serve` (no Vite).
*   **Styling:** Tailwind CSS with `shadcn/ui` components.
*   **Services:** Services in the app layer should always return void.

### Testing Guidelines

*   **Framework:** `bun:test`.
*   **Pattern:** Arrange-Act-Assert (AAA).
*   **Concurrency:** Tests must be safe to run in parallel.
    *   **NO** `beforeEach`, `afterEach`, `beforeAll`, `afterAll`.
    *   Use unique IDs (UUIDv7) for every test entity to avoid collisions.
    *   Each test should be self-contained.
*   **Scope:** Test public methods and all code paths (happy path, error scenarios, edge cases).
*   **Reference:** See `tests/infrastructure/transactionBatcher.test.ts` for the gold standard.
*   **TEST COMMAND:** Run tests with `bun test --concurrent`

## Feature Implementation Guide

### Adding a New Aggregate
1.  **Events:** Define in `src/domain/<aggregate>/events.ts`.
2.  **Aggregate:** Create class in `src/domain/<aggregate>/aggregate.ts` (implement `create`, `apply`, `loadFromSnapshot`, `toSnapshot`).
3.  **Commands:** Define Zod schemas in `src/app/<aggregate>/commands.ts`.
4.  **Services:** Implement command handlers in `src/app/<aggregate>/`.
5.  **Routing:** Add routes in `src/infrastructure/routers/`.
6.  **Projections:** Create handlers in `src/views/<aggregate>/` and register in `src/index.ts`.

### Adding a New Command
1.  Define Zod schema.
2.  Create service function.
3.  Add routing.
4.  Update projections if necessary.

## Environment Variables

*   `NODE_ENV`: "development" | "production"
*   `BETTER_AUTH_URL`: Auth base URL.
*   `IMAGE_STORAGE_TYPE`: "local" | "s3"
