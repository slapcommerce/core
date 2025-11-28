import type { Database } from "bun:sqlite";

export const schemas = [
  `CREATE TABLE IF NOT EXISTS events (
    eventType TEXT NOT NULL,
    version INTEGER NOT NULL,
    aggregateId TEXT NOT NULL,
    correlationId TEXT NOT NULL,
    occurredAt TEXT NOT NULL,
    userId TEXT NOT NULL,
    payload TEXT NOT NULL,
    PRIMARY KEY (aggregateId, version)
  )`,
  `CREATE TABLE IF NOT EXISTS snapshots (
    aggregateId TEXT PRIMARY KEY,
    correlationId TEXT NOT NULL,
    version INTEGER NOT NULL,
    payload TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS outbox (
    id TEXT PRIMARY KEY,
    aggregateId TEXT NOT NULL,
    eventType TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    retryCount INTEGER NOT NULL DEFAULT 0,
    lastAttemptAt TEXT,
    nextRetryAt TEXT,
    idempotencyKey TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS outboxProcessing (
    id TEXT PRIMARY KEY,
    outboxId TEXT NOT NULL,
    handlerId TEXT NOT NULL,
    idempotencyKey TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending',
    retryCount INTEGER NOT NULL DEFAULT 0,
    lastAttemptAt TEXT,
    nextRetryAt TEXT,
    processedAt TEXT,
    FOREIGN KEY (outboxId) REFERENCES outbox(id)
  )`,
  `CREATE TABLE IF NOT EXISTS outboxDlq (
    id TEXT PRIMARY KEY,
    outboxId TEXT NOT NULL,
    handlerId TEXT NOT NULL,
    eventType TEXT NOT NULL,
    payload TEXT NOT NULL,
    errorMessage TEXT,
    finalRetryCount INTEGER NOT NULL,
    failedAt TEXT NOT NULL,
    originalOccurredAt TEXT,
    FOREIGN KEY (outboxId) REFERENCES outbox(id)
  )`,
  `CREATE TABLE IF NOT EXISTS productReadModel (
    aggregateId TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    vendor TEXT NOT NULL,
    description TEXT NOT NULL,
    tags TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    correlationId TEXT NOT NULL,
    taxable INTEGER NOT NULL DEFAULT 1,
    fulfillmentType TEXT NOT NULL,
    dropshipSafetyBuffer INTEGER,
    variantOptions TEXT NOT NULL DEFAULT '[]',
    version INTEGER NOT NULL,
    updatedAt TEXT NOT NULL,
    collectionIds TEXT NOT NULL,
    metaTitle TEXT NOT NULL DEFAULT '',
    metaDescription TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS idx_productReadModel_status ON productReadModel(status)`,
  `CREATE TABLE IF NOT EXISTS collectionsReadModel (
    aggregateId TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    correlationId TEXT NOT NULL,
    version INTEGER NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    metaTitle TEXT NOT NULL DEFAULT '',
    metaDescription TEXT NOT NULL DEFAULT '',
    publishedAt TEXT,
    images TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_collectionsReadModel_status ON collectionsReadModel(status)`,
  `CREATE TABLE IF NOT EXISTS slugRedirects (
    oldSlug TEXT PRIMARY KEY,
    newSlug TEXT NOT NULL,
    aggregateId TEXT NOT NULL,
    aggregateType TEXT NOT NULL,
    productId TEXT,
    createdAt TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_slugRedirects_newSlug ON slugRedirects(newSlug)`,
  `CREATE INDEX IF NOT EXISTS idx_slugRedirects_aggregate ON slugRedirects(aggregateId, aggregateType)`,
  // Better Auth tables - kept as-is per requirements
  `CREATE TABLE IF NOT EXISTS user (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    emailVerified INTEGER NOT NULL,
    image TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS session (
    id TEXT NOT NULL PRIMARY KEY,
    expiresAt TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    ipAddress TEXT,
    userAgent TEXT,
    userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS account (
    id TEXT NOT NULL PRIMARY KEY,
    accountId TEXT NOT NULL,
    providerId TEXT NOT NULL,
    userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    accessToken TEXT,
    refreshToken TEXT,
    idToken TEXT,
    accessTokenExpiresAt TEXT,
    refreshTokenExpiresAt TEXT,
    scope TEXT,
    password TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS verification (
    id TEXT NOT NULL PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS schedulesReadModel (
    aggregateId TEXT PRIMARY KEY,
    targetAggregateId TEXT NOT NULL,
    targetAggregateType TEXT NOT NULL,
    commandType TEXT NOT NULL,
    commandData TEXT,
    scheduledFor TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    retryCount INTEGER NOT NULL DEFAULT 0,
    nextRetryAt TEXT,
    createdBy TEXT NOT NULL,
    errorMessage TEXT,
    correlationId TEXT NOT NULL,
    version INTEGER NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_schedulesReadModel_status ON schedulesReadModel(status)`,
  `CREATE INDEX IF NOT EXISTS idx_schedulesReadModel_scheduledFor ON schedulesReadModel(scheduledFor)`,
  `CREATE INDEX IF NOT EXISTS idx_schedulesReadModel_status_scheduledFor ON schedulesReadModel(status, scheduledFor)`,
  `CREATE INDEX IF NOT EXISTS idx_schedulesReadModel_targetAggregate ON schedulesReadModel(targetAggregateId)`,
  `CREATE TABLE IF NOT EXISTS variantReadModel (
    aggregateId TEXT PRIMARY KEY,
    productId TEXT NOT NULL,
    sku TEXT NOT NULL,
    price REAL NOT NULL,
    inventory INTEGER NOT NULL,
    options TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    correlationId TEXT NOT NULL,
    version INTEGER NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    publishedAt TEXT,
    images TEXT NOT NULL,
    digitalAsset TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_variantReadModel_productId ON variantReadModel(productId)`,
  `CREATE INDEX IF NOT EXISTS idx_variantReadModel_status ON variantReadModel(status)`,
  `CREATE INDEX IF NOT EXISTS idx_variantReadModel_sku ON variantReadModel(sku)`,
];

/**
 * Run database migrations to add missing columns to existing tables
 * This is safe to run multiple times - it checks if columns exist before adding them
 */
export function runMigrations(_db: Database): void {
  // No migrations currently required
  // This function is kept for future migrations
}
