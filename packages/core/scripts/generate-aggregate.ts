#!/usr/bin/env bun

import { mkdir, writeFile, readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

// =============================================================================
// File Manipulation Utilities
// =============================================================================

async function readFileContent(filePath: string): Promise<string> {
  return await readFile(filePath, "utf-8");
}

async function writeFileContent(filePath: string, content: string): Promise<void> {
  await writeFile(filePath, content);
}

function insertBefore(content: string, searchPattern: string, insertion: string): string {
  const index = content.indexOf(searchPattern);
  if (index === -1) {
    throw new Error(`Pattern not found: ${searchPattern}`);
  }
  return content.slice(0, index) + insertion + content.slice(index);
}

function insertAfter(content: string, searchPattern: string, insertion: string): string {
  const index = content.indexOf(searchPattern);
  if (index === -1) {
    throw new Error(`Pattern not found: ${searchPattern}`);
  }
  const endIndex = index + searchPattern.length;
  return content.slice(0, endIndex) + insertion + content.slice(endIndex);
}

// =============================================================================
// Types
// =============================================================================

interface Attribute {
  name: string;
  type: string;
  isOptional: boolean;
  isArray: boolean;
  isEnum: boolean;
  enumValues?: string[];
  baseType: string; // The underlying type without optional/array modifiers
}

interface AggregateConfig {
  name: string; // PascalCase
  nameCamel: string; // camelCase
  namePlural: string; // plural PascalCase
  namePluralCamel: string; // plural camelCase
  includeStatusWorkflow: boolean;
  attributes: Attribute[];
}

// =============================================================================
// Naming Utilities
// =============================================================================

function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function toPascalCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function pluralize(str: string): string {
  // Simple pluralization rules
  if (str.endsWith("y") && !["ay", "ey", "iy", "oy", "uy"].some(v => str.endsWith(v))) {
    return str.slice(0, -1) + "ies";
  }
  if (str.endsWith("s") || str.endsWith("x") || str.endsWith("z") || str.endsWith("ch") || str.endsWith("sh")) {
    return str + "es";
  }
  return str + "s";
}

// =============================================================================
// Type Parsing
// =============================================================================

function parseAttributeType(typeStr: string): Omit<Attribute, "name"> {
  let isOptional = false;
  let isArray = false;
  let isEnum = false;
  let enumValues: string[] | undefined;
  let baseType = typeStr;

  // Handle optional prefix
  if (typeStr.startsWith("optional:")) {
    isOptional = true;
    baseType = typeStr.slice(9);
  }

  // Handle array types
  if (baseType.endsWith("[]")) {
    isArray = true;
    baseType = baseType.slice(0, -2);
  }

  // Handle enum types
  if (baseType.startsWith("enum:")) {
    isEnum = true;
    enumValues = baseType.slice(5).split(",").map(v => v.trim());
    baseType = "enum";
  }

  return { type: typeStr, isOptional, isArray, isEnum, enumValues, baseType };
}

function toTypeScriptType(attr: Attribute): string {
  let tsType: string;

  if (attr.isEnum && attr.enumValues) {
    tsType = attr.enumValues.map(v => `"${v}"`).join(" | ");
  } else {
    switch (attr.baseType) {
      case "string": tsType = "string"; break;
      case "number": tsType = "number"; break;
      case "boolean": tsType = "boolean"; break;
      case "Date": tsType = "Date"; break;
      default: tsType = "string";
    }
  }

  if (attr.isArray) {
    tsType = `${tsType.includes("|") ? `(${tsType})` : tsType}[]`;
  }

  if (attr.isOptional) {
    tsType = `${tsType} | null`;
  }

  return tsType;
}

function toZodType(attr: Attribute): string {
  let zodType: string;

  if (attr.isEnum && attr.enumValues) {
    zodType = `z.enum([${attr.enumValues.map(v => `"${v}"`).join(", ")}])`;
  } else {
    switch (attr.baseType) {
      case "string": zodType = "z.string()"; break;
      case "number": zodType = "z.number()"; break;
      case "boolean": zodType = "z.boolean()"; break;
      case "Date": zodType = "z.coerce.date()"; break;
      default: zodType = "z.string()";
    }
  }

  if (attr.isArray) {
    zodType = `z.array(${zodType})`;
  }

  if (attr.isOptional) {
    zodType = `${zodType}.nullable().optional()`;
  }

  return zodType;
}

function toSqlType(attr: Attribute): string {
  if (attr.isArray) return "TEXT"; // JSON serialized

  switch (attr.baseType) {
    case "string": return "TEXT";
    case "number": return "REAL";
    case "boolean": return "INTEGER";
    case "Date": return "TEXT";
    case "enum": return "TEXT";
    default: return "TEXT";
  }
}

function getDefaultValue(attr: Attribute): string {
  if (attr.isOptional) return "null";
  if (attr.isArray) return "[]";

  switch (attr.baseType) {
    case "string": return '""';
    case "number": return "0";
    case "boolean": return "false";
    case "Date": return "new Date()";
    case "enum": return attr.enumValues ? `"${attr.enumValues[0]}"` : '""';
    default: return '""';
  }
}

// =============================================================================
// Template: Events
// =============================================================================

function generateEvents(config: AggregateConfig): string {
  const { name, nameCamel } = config;
  const stateFields = generateStateFields(config);
  const eventTypes = getEventTypes(config);

  let eventClasses = "";

  // Created Event
  eventClasses += generateEventClass(config, "Created", `${nameCamel}.created`);

  // Archived Event
  eventClasses += generateEventClass(config, "Archived", `${nameCamel}.archived`);

  // Status workflow events
  if (config.includeStatusWorkflow) {
    eventClasses += generateEventClass(config, "Published", `${nameCamel}.published`);
    eventClasses += generateEventClass(config, "Unpublished", `${nameCamel}.unpublished`);
  }

  return `import type { DomainEvent, StateBasedPayload } from "../_base/domainEvent";

export type ${name}State = {
${stateFields}
  [key: string]: unknown;
};

${eventClasses}
export type ${name}Event =
${eventTypes.map(t => `  | ${name}${t}Event`).join("\n")};
`;
}

function generateStateFields(config: AggregateConfig): string {
  const fields: string[] = [];

  // Custom attributes
  for (const attr of config.attributes) {
    const tsType = toTypeScriptType(attr);
    fields.push(`  ${attr.name}: ${tsType};`);
  }

  // Status fields (if enabled)
  if (config.includeStatusWorkflow) {
    fields.push(`  status: "draft" | "active" | "archived";`);
    fields.push(`  publishedAt: Date | null;`);
  }

  // Base fields
  fields.push(`  createdAt: Date;`);
  fields.push(`  updatedAt: Date;`);

  return fields.join("\n");
}

function getEventTypes(config: AggregateConfig): string[] {
  const types = ["Created", "Archived"];
  if (config.includeStatusWorkflow) {
    types.push("Published", "Unpublished");
  }
  return types;
}

function generateEventClass(config: AggregateConfig, eventType: string, eventName: string): string {
  const { name } = config;

  return `type ${name}${eventType}EventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ${name}State;
  newState: ${name}State;
};

export class ${name}${eventType}Event implements DomainEvent {
  occurredAt: Date;
  eventName = "${eventName}" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<${name}State>;

  constructor({
    occurredAt,
    aggregateId,
    correlationId,
    version,
    userId,
    priorState,
    newState,
  }: ${name}${eventType}EventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

`;
}

// =============================================================================
// Template: Aggregate
// =============================================================================

function generateAggregate(config: AggregateConfig): string {
  const { name, nameCamel } = config;
  const eventTypes = getEventTypes(config);

  const eventImports = eventTypes.map(t => `${name}${t}Event`).join(",\n  ");
  const aggregateParamsFields = generateAggregateParamsFields(config);
  const createParamsFields = generateCreateParamsFields(config);
  const classFields = generateClassFields(config);
  const constructorAssignments = generateConstructorAssignments(config);
  const createDefaults = generateCreateDefaults(config);
  const toStateFields = generateToStateFields(config);
  const snapshotFields = generateSnapshotFields(config);
  const loadFromSnapshotFields = generateLoadFromSnapshotFields(config);
  const statusMethods = config.includeStatusWorkflow ? generateStatusMethods(config) : "";

  return `import {
  ${eventImports},
  type ${name}State,
  type ${name}Event,
} from "./events";

type ${name}AggregateParams = {
  id: string;
  correlationId: string;
  createdAt: Date;
  updatedAt: Date;
${aggregateParamsFields}
  version: number;
  events: ${name}Event[];
${config.includeStatusWorkflow ? `  status: "draft" | "active" | "archived";
  publishedAt: Date | null;` : ""}
};

type Create${name}AggregateParams = {
  id: string;
  correlationId: string;
  userId: string;
${createParamsFields}
};

export class ${name}Aggregate {
  public id: string;
  public version: number = 0;
  public events: ${name}Event[];
  public uncommittedEvents: ${name}Event[] = [];
  private correlationId: string;
  private createdAt: Date;
  private updatedAt: Date;
${classFields}
${config.includeStatusWorkflow ? `  private status: "draft" | "active" | "archived";
  private publishedAt: Date | null;` : ""}

  constructor({
    id,
    correlationId,
    createdAt,
    updatedAt,
${config.attributes.map(a => `    ${a.name},`).join("\n")}
    version = 0,
    events,
${config.includeStatusWorkflow ? `    status,
    publishedAt,` : ""}
  }: ${name}AggregateParams) {
    this.id = id;
    this.correlationId = correlationId;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
${constructorAssignments}
    this.version = version;
    this.events = events;
${config.includeStatusWorkflow ? `    this.status = status;
    this.publishedAt = publishedAt;` : ""}
  }

  static create({
    id,
    correlationId,
    userId,
${config.attributes.map(a => `    ${a.name},`).join("\n")}
  }: Create${name}AggregateParams) {
    const createdAt = new Date();
    const ${nameCamel}Aggregate = new ${name}Aggregate({
      id,
      correlationId,
      createdAt,
      updatedAt: createdAt,
${createDefaults}
      version: 0,
      events: [],
${config.includeStatusWorkflow ? `      status: "draft",
      publishedAt: null,` : ""}
    });
    const priorState = {} as ${name}State;
    const newState = ${nameCamel}Aggregate.toState();
    const ${nameCamel}CreatedEvent = new ${name}CreatedEvent({
      occurredAt: createdAt,
      correlationId,
      aggregateId: id,
      version: 0,
      userId,
      priorState,
      newState,
    });
    ${nameCamel}Aggregate.uncommittedEvents.push(${nameCamel}CreatedEvent);
    return ${nameCamel}Aggregate;
  }

  private toState(): ${name}State {
    return {
${toStateFields}
${config.includeStatusWorkflow ? `      status: this.status,
      publishedAt: this.publishedAt,` : ""}
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  archive(userId: string) {
    ${config.includeStatusWorkflow ? `if (this.status === "archived") {
      throw new Error("${name} is already archived");
    }` : ""}
    const occurredAt = new Date();
    const priorState = this.toState();
    ${config.includeStatusWorkflow ? `this.status = "archived";` : ""}
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const archivedEvent = new ${name}ArchivedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(archivedEvent);
    return this;
  }
${statusMethods}
  static loadFromSnapshot(snapshot: {
    aggregateId: string;
    correlationId: string;
    version: number;
    payload: string;
  }) {
    const payload = JSON.parse(snapshot.payload);
    return new ${name}Aggregate({
      id: snapshot.aggregateId,
      correlationId: snapshot.correlationId,
      createdAt: new Date(payload.createdAt),
      updatedAt: new Date(payload.updatedAt),
${loadFromSnapshotFields}
      version: snapshot.version,
      events: [],
${config.includeStatusWorkflow ? `      status: payload.status,
      publishedAt: payload.publishedAt ? new Date(payload.publishedAt) : null,` : ""}
    });
  }

  toSnapshot() {
    return {
      id: this.id,
${snapshotFields}
${config.includeStatusWorkflow ? `      status: this.status,
      publishedAt: this.publishedAt,` : ""}
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      version: this.version,
    };
  }
}
`;
}

function generateAggregateParamsFields(config: AggregateConfig): string {
  return config.attributes.map(attr => {
    const tsType = toTypeScriptType(attr);
    return `  ${attr.name}: ${tsType};`;
  }).join("\n");
}

function generateCreateParamsFields(config: AggregateConfig): string {
  return config.attributes.map(attr => {
    const tsType = toTypeScriptType(attr);
    return `  ${attr.name}: ${tsType};`;
  }).join("\n");
}

function generateClassFields(config: AggregateConfig): string {
  return config.attributes.map(attr => {
    const tsType = toTypeScriptType(attr);
    return `  private ${attr.name}: ${tsType};`;
  }).join("\n");
}

function generateConstructorAssignments(config: AggregateConfig): string {
  return config.attributes.map(attr => `    this.${attr.name} = ${attr.name};`).join("\n");
}

function generateCreateDefaults(config: AggregateConfig): string {
  return config.attributes.map(attr => `      ${attr.name},`).join("\n");
}

function generateToStateFields(config: AggregateConfig): string {
  return config.attributes.map(attr => `      ${attr.name}: this.${attr.name},`).join("\n");
}

function generateSnapshotFields(config: AggregateConfig): string {
  return config.attributes.map(attr => `      ${attr.name}: this.${attr.name},`).join("\n");
}

function generateLoadFromSnapshotFields(config: AggregateConfig): string {
  return config.attributes.map(attr => {
    if (attr.baseType === "Date" && !attr.isArray) {
      if (attr.isOptional) {
        return `      ${attr.name}: payload.${attr.name} ? new Date(payload.${attr.name}) : null,`;
      }
      return `      ${attr.name}: new Date(payload.${attr.name}),`;
    }
    if (attr.isOptional) {
      return `      ${attr.name}: payload.${attr.name} ?? null,`;
    }
    return `      ${attr.name}: payload.${attr.name},`;
  }).join("\n");
}

function generateStatusMethods(config: AggregateConfig): string {
  const { name } = config;

  return `
  publish(userId: string) {
    if (this.status === "archived") {
      throw new Error("Cannot publish an archived ${name.toLowerCase()}");
    }
    if (this.status === "active") {
      throw new Error("${name} is already published");
    }
    const occurredAt = new Date();
    const priorState = this.toState();
    this.status = "active";
    this.publishedAt = occurredAt;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const publishedEvent = new ${name}PublishedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(publishedEvent);
    return this;
  }

  unpublish(userId: string) {
    if (this.status === "archived") {
      throw new Error("Cannot unpublish an archived ${name.toLowerCase()}");
    }
    if (this.status === "draft") {
      throw new Error("${name} is already unpublished");
    }
    const occurredAt = new Date();
    const priorState = this.toState();
    this.status = "draft";
    this.publishedAt = null;
    this.updatedAt = occurredAt;
    this.version++;
    const newState = this.toState();
    const unpublishedEvent = new ${name}UnpublishedEvent({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(unpublishedEvent);
    return this;
  }
`;
}

// =============================================================================
// Template: Commands
// =============================================================================

function generateCommands(config: AggregateConfig): string {
  const { name } = config;
  const createCommandFields = generateCreateCommandFields(config);
  let commands = "";

  // Create Command
  commands += `export const Create${name}Command = z.object({
  id: z.uuidv7(),
  type: z.literal("create${name}"),
  correlationId: z.uuidv7(),
  userId: z.string(),
${createCommandFields}
});

export type Create${name}Command = z.infer<typeof Create${name}Command>;

`;

  // Archive Command
  commands += `export const Archive${name}Command = z.object({
  id: z.uuidv7(),
  type: z.literal("archive${name}"),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type Archive${name}Command = z.infer<typeof Archive${name}Command>;

`;

  // Status workflow commands
  if (config.includeStatusWorkflow) {
    commands += `export const Publish${name}Command = z.object({
  id: z.uuidv7(),
  type: z.literal("publish${name}"),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type Publish${name}Command = z.infer<typeof Publish${name}Command>;

export const Unpublish${name}Command = z.object({
  id: z.uuidv7(),
  type: z.literal("unpublish${name}"),
  userId: z.string(),
  expectedVersion: z.number().int().nonnegative(),
});

export type Unpublish${name}Command = z.infer<typeof Unpublish${name}Command>;

`;
  }

  return `import { z } from "zod";

${commands}`;
}

function generateCreateCommandFields(config: AggregateConfig): string {
  return config.attributes.map(attr => {
    const zodType = toZodType(attr);
    return `  ${attr.name}: ${zodType},`;
  }).join("\n");
}

// =============================================================================
// Template: Create Service
// =============================================================================

function generateCreateService(config: AggregateConfig): string {
  const { name, nameCamel } = config;

  return `import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { Create${name}Command } from "./commands";
import { ${name}Aggregate } from "../../../../domain/${nameCamel}/aggregate";
import { randomUUIDv7 } from "bun";
import type { Service } from "../../../service";

export class Create${name}Service implements Service<Create${name}Command> {
  constructor(private unitOfWork: UnitOfWork) {
    this.unitOfWork = unitOfWork;
  }

  async execute(command: Create${name}Command) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } = repositories;

      // Create aggregate
      const ${nameCamel}Aggregate = ${name}Aggregate.create({
        ...command,
      });

      // Handle events
      for (const event of ${nameCamel}Aggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Save snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: ${nameCamel}Aggregate.id,
        correlationId: command.correlationId,
        version: ${nameCamel}Aggregate.version,
        payload: ${nameCamel}Aggregate.toSnapshot(),
      });

      // Add events to outbox
      for (const event of ${nameCamel}Aggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }
}
`;
}

// =============================================================================
// Template: Archive Service
// =============================================================================

function generateArchiveService(config: AggregateConfig): string {
  const { name, nameCamel } = config;

  return `import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { Archive${name}Command } from "./commands";
import { ${name}Aggregate } from "../../../../domain/${nameCamel}/aggregate";
import { randomUUIDv7 } from "bun";
import type { Service } from "../../../service";

export class Archive${name}Service implements Service<Archive${name}Command> {
  constructor(private unitOfWork: UnitOfWork) {
    this.unitOfWork = unitOfWork;
  }

  async execute(command: Archive${name}Command) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } = repositories;

      // Load aggregate from snapshot
      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error("${name} not found");
      }

      const ${nameCamel}Aggregate = ${name}Aggregate.loadFromSnapshot(snapshot);

      // Check version
      if (${nameCamel}Aggregate.version !== command.expectedVersion) {
        throw new Error("Version mismatch");
      }

      // Archive the aggregate
      ${nameCamel}Aggregate.archive(command.userId);

      // Handle events
      for (const event of ${nameCamel}Aggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Save snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: ${nameCamel}Aggregate.id,
        correlationId: snapshot.correlationId,
        version: ${nameCamel}Aggregate.version,
        payload: ${nameCamel}Aggregate.toSnapshot(),
      });

      // Add events to outbox
      for (const event of ${nameCamel}Aggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }
}
`;
}

// =============================================================================
// Template: Publish Service
// =============================================================================

function generatePublishService(config: AggregateConfig): string {
  const { name, nameCamel } = config;

  return `import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { Publish${name}Command } from "./commands";
import { ${name}Aggregate } from "../../../../domain/${nameCamel}/aggregate";
import { randomUUIDv7 } from "bun";
import type { Service } from "../../../service";

export class Publish${name}Service implements Service<Publish${name}Command> {
  constructor(private unitOfWork: UnitOfWork) {
    this.unitOfWork = unitOfWork;
  }

  async execute(command: Publish${name}Command) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } = repositories;

      // Load aggregate from snapshot
      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error("${name} not found");
      }

      const ${nameCamel}Aggregate = ${name}Aggregate.loadFromSnapshot(snapshot);

      // Check version
      if (${nameCamel}Aggregate.version !== command.expectedVersion) {
        throw new Error("Version mismatch");
      }

      // Publish the aggregate
      ${nameCamel}Aggregate.publish(command.userId);

      // Handle events
      for (const event of ${nameCamel}Aggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Save snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: ${nameCamel}Aggregate.id,
        correlationId: snapshot.correlationId,
        version: ${nameCamel}Aggregate.version,
        payload: ${nameCamel}Aggregate.toSnapshot(),
      });

      // Add events to outbox
      for (const event of ${nameCamel}Aggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }
}
`;
}

// =============================================================================
// Template: Unpublish Service
// =============================================================================

function generateUnpublishService(config: AggregateConfig): string {
  const { name, nameCamel } = config;

  return `import type { UnitOfWork } from "../../../../infrastructure/unitOfWork";
import type { Unpublish${name}Command } from "./commands";
import { ${name}Aggregate } from "../../../../domain/${nameCamel}/aggregate";
import { randomUUIDv7 } from "bun";
import type { Service } from "../../../service";

export class Unpublish${name}Service implements Service<Unpublish${name}Command> {
  constructor(private unitOfWork: UnitOfWork) {
    this.unitOfWork = unitOfWork;
  }

  async execute(command: Unpublish${name}Command) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } = repositories;

      // Load aggregate from snapshot
      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error("${name} not found");
      }

      const ${nameCamel}Aggregate = ${name}Aggregate.loadFromSnapshot(snapshot);

      // Check version
      if (${nameCamel}Aggregate.version !== command.expectedVersion) {
        throw new Error("Version mismatch");
      }

      // Unpublish the aggregate
      ${nameCamel}Aggregate.unpublish(command.userId);

      // Handle events
      for (const event of ${nameCamel}Aggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      // Save snapshot
      snapshotRepository.saveSnapshot({
        aggregateId: ${nameCamel}Aggregate.id,
        correlationId: snapshot.correlationId,
        version: ${nameCamel}Aggregate.version,
        payload: ${nameCamel}Aggregate.toSnapshot(),
      });

      // Add events to outbox
      for (const event of ${nameCamel}Aggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, {
          id: randomUUIDv7(),
        });
      }
    });
  }
}
`;
}

// =============================================================================
// Template: Read Model Repository
// =============================================================================

function generateReadModelRepository(config: AggregateConfig): string {
  const { name, nameCamel, namePlural, namePluralCamel } = config;
  const columns = generateReadModelColumns(config);
  const placeholders = generateReadModelPlaceholders(config);
  const params = generateReadModelParams(config);

  return `import type { Database } from "bun:sqlite";
import type { TransactionBatch } from "../../transactionBatch";
import type { ${name}State } from "@/api/domain/${nameCamel}/events";

export class ${namePlural}ReadModelRepository {
  private db: Database;
  private batch: TransactionBatch;

  constructor(db: Database, batch: TransactionBatch) {
    this.db = db;
    this.batch = batch;
  }

  save(state: ${name}State & { id: string; correlationId: string; version: number }) {
    const statement = this.db.query(
      \`INSERT OR REPLACE INTO ${nameCamel}ReadModel (
        aggregateId, correlationId, version,${columns}
        createdAt, updatedAt${config.includeStatusWorkflow ? ", status, publishedAt" : ""}
      ) VALUES (?, ?, ?,${placeholders}
        ?, ?${config.includeStatusWorkflow ? ", ?, ?" : ""})\`,
    );

    this.batch.addCommand({
      statement,
      params: [
        state.id,
        state.correlationId,
        state.version,${params}
        state.createdAt.toISOString(),
        state.updatedAt.toISOString(),${config.includeStatusWorkflow ? `
        state.status,
        state.publishedAt?.toISOString() ?? null,` : ""}
      ],
      type: "insert",
    });
  }
}
`;
}

function generateReadModelColumns(config: AggregateConfig): string {
  return config.attributes.map(attr => `\n        ${attr.name},`).join("");
}

function generateReadModelPlaceholders(config: AggregateConfig): string {
  return config.attributes.map(() => "\n        ?,").join("");
}

function generateReadModelParams(config: AggregateConfig): string {
  return config.attributes.map(attr => {
    if (attr.isArray) {
      return `\n        JSON.stringify(state.${attr.name}),`;
    }
    if (attr.baseType === "boolean") {
      return `\n        state.${attr.name} ? 1 : 0,`;
    }
    if (attr.baseType === "Date" && !attr.isArray) {
      if (attr.isOptional) {
        return `\n        state.${attr.name}?.toISOString() ?? null,`;
      }
      return `\n        state.${attr.name}.toISOString(),`;
    }
    if (attr.isOptional) {
      return `\n        state.${attr.name} ?? null,`;
    }
    return `\n        state.${attr.name},`;
  }).join("");
}

// =============================================================================
// Template: Projector
// =============================================================================

function generateProjector(config: AggregateConfig): string {
  const { name, nameCamel, namePlural, namePluralCamel } = config;
  const eventTypes = getEventTypes(config);
  const eventHandlers = eventTypes.map(t => `      "${nameCamel}.${t.toLowerCase()}": this.project.bind(this),`).join("\n");

  return `import type { ${name}Event } from "../../../domain/${nameCamel}/events";
import { Projector, type ProjectorHandlers } from "../_base/projector";
import type { UnitOfWorkRepositories } from "../../unitOfWork";

export class ${namePlural}Projector extends Projector<${name}Event> {
  protected handlers: ProjectorHandlers<${name}Event["eventName"]>;

  constructor(repositories: UnitOfWorkRepositories) {
    super(repositories);
    this.handlers = {
${eventHandlers}
    };
  }

  private async project(event: ${name}Event): Promise<void> {
    const state = {
      ...event.payload.newState,
      id: event.aggregateId,
      correlationId: event.correlationId,
      version: event.version,
    };
    this.repositories.${namePluralCamel}ReadModelRepository.save(state);
  }
}
`;
}

// =============================================================================
// Auto-Wiring Functions
// =============================================================================

async function wireEventTypes(basePath: string, config: AggregateConfig): Promise<void> {
  const { name, nameCamel } = config;
  const filePath = join(basePath, "domain/_base/domainEvent.ts");
  let content = await readFileContent(filePath);

  // Generate event types to add
  let eventTypes = `\n  // ${name} events\n  | "${nameCamel}.created"\n  | "${nameCamel}.archived"`;
  if (config.includeStatusWorkflow) {
    eventTypes += `\n  | "${nameCamel}.published"\n  | "${nameCamel}.unpublished"`;
  }

  // Find the last event type before the semicolon and add new types
  // Look for the pattern: | "schedule.cancelled";
  content = insertBefore(content, `| "schedule.cancelled";`, eventTypes + `\n  `);

  // Add to DomainEventUnion - find the last import line
  const domainEventImport = `\n  | import("../${nameCamel}/events").${name}Event;`;
  content = insertAfter(content, `| import("../slug/slugEvents").SlugEvent;`, domainEventImport);

  await writeFileContent(filePath, content);
}

async function wireCommandTypes(basePath: string, config: AggregateConfig): Promise<void> {
  const { name } = config;
  const filePath = join(basePath, "app/command.ts");
  let content = await readFileContent(filePath);

  // Generate command types to add
  let commandTypes = `\n    | "create${name}"\n    | "archive${name}"`;
  if (config.includeStatusWorkflow) {
    commandTypes += `\n    | "publish${name}"\n    | "unpublish${name}"`;
  }

  // Find the last command type before the semicolon
  content = insertBefore(content, `| "cancelSchedule";`, commandTypes + `\n    `);

  await writeFileContent(filePath, content);
}

async function wireSchemas(basePath: string, config: AggregateConfig): Promise<void> {
  const { nameCamel } = config;
  const filePath = join(basePath, "infrastructure/schemas.ts");
  let content = await readFileContent(filePath);

  // Generate schema columns
  const schemaColumns = generateSchemaColumns(config);

  // Generate the schema SQL
  const schemaSql = `  \`CREATE TABLE IF NOT EXISTS ${nameCamel}ReadModel (
    aggregateId TEXT PRIMARY KEY,
    correlationId TEXT NOT NULL,
    version INTEGER NOT NULL,${schemaColumns}
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL${config.includeStatusWorkflow ? `,
    status TEXT NOT NULL DEFAULT 'draft',
    publishedAt TEXT` : ""}
  )\`,
  \`CREATE INDEX IF NOT EXISTS idx_${nameCamel}ReadModel_status ON ${nameCamel}ReadModel(status)\`,
`;

  // Find the closing bracket of the schemas array
  content = insertBefore(content, `];

/**
 * Run database migrations`, schemaSql);

  await writeFileContent(filePath, content);
}

async function wireUnitOfWork(basePath: string, config: AggregateConfig): Promise<void> {
  const { name, namePlural, namePluralCamel } = config;
  const filePath = join(basePath, "infrastructure/unitOfWork.ts");
  let content = await readFileContent(filePath);

  // 1. Add import statement
  const importStatement = `\nimport { ${namePlural}ReadModelRepository } from "./repositories/readModels/${namePluralCamel}ReadModelRepository";`;
  content = insertAfter(content, `import { ProductVariantsReadModelRepository } from "./repositories/readModels/productVariantsReadModelRepository";`, importStatement);

  // 2. Add to UnitOfWorkRepositories type
  const typeProperty = `\n  ${namePluralCamel}ReadModelRepository: ${namePlural}ReadModelRepository;`;
  content = insertAfter(content, `productVariantsReadModelRepository: ProductVariantsReadModelRepository;`, typeProperty);

  // 3. Add factory property
  const factoryProperty = `\n  private ${namePlural}ReadModelRepositoryFactory: typeof ${namePlural}ReadModelRepository;`;
  content = insertAfter(content, `private ProductVariantsReadModelRepositoryFactory: typeof ProductVariantsReadModelRepository;`, factoryProperty);

  // 4. Add constructor assignment
  const constructorAssignment = `\n    this.${namePlural}ReadModelRepositoryFactory = ${namePlural}ReadModelRepository;`;
  content = insertAfter(content, `this.ProductVariantsReadModelRepositoryFactory = ProductVariantsReadModelRepository;`, constructorAssignment);

  // 5. Add instantiation in withTransaction
  const instantiation = `\n    const ${namePluralCamel}ReadModelRepository =\n      new this.${namePlural}ReadModelRepositoryFactory(this.db, batch);`;
  content = insertAfter(content, `const productVariantsReadModelRepository =
      new this.ProductVariantsReadModelRepositoryFactory(this.db, batch);`, instantiation);

  // 6. Add to repositories object
  const repositoryEntry = `\n      ${namePluralCamel}ReadModelRepository,`;
  content = insertAfter(content, `productVariantsReadModelRepository,`, repositoryEntry);

  await writeFileContent(filePath, content);
}

async function wireAdminCommandsRouter(basePath: string, config: AggregateConfig): Promise<void> {
  const { name, nameCamel } = config;
  const filePath = join(basePath, "infrastructure/routers/adminCommandsRouter.ts");
  let content = await readFileContent(filePath);

  // 1. Add service imports
  let serviceImports = `\nimport { Create${name}Service } from "../../app/${nameCamel}/commands/admin/create${name}Service";`;
  serviceImports += `\nimport { Archive${name}Service } from "../../app/${nameCamel}/commands/admin/archive${name}Service";`;
  if (config.includeStatusWorkflow) {
    serviceImports += `\nimport { Publish${name}Service } from "../../app/${nameCamel}/commands/admin/publish${name}Service";`;
    serviceImports += `\nimport { Unpublish${name}Service } from "../../app/${nameCamel}/commands/admin/unpublish${name}Service";`;
  }
  content = insertAfter(content, `import { SetDefaultVariantService } from "../../app/product/commands/admin/setDefaultVariantService";`, serviceImports);

  // 2. Add command imports
  let commandImports = `\nimport {\n  Create${name}Command,\n  Archive${name}Command,`;
  if (config.includeStatusWorkflow) {
    commandImports += `\n  Publish${name}Command,\n  Unpublish${name}Command,`;
  }
  commandImports += `\n} from "../../app/${nameCamel}/commands/admin/commands";`;
  content = insertAfter(content, `} from "../../app/schedule/commands/admin/commands";`, commandImports);

  // 3. Add handler registrations at end of initializeHandlers
  let handlers = `

    // ${name} commands
    const create${name}Service = new Create${name}Service(unitOfWork);
    this.handlers.set("create${name}", {
      parse: (p) => Create${name}Command.parse(p),
      execute: (c) => create${name}Service.execute(c as Create${name}Command),
    });

    const archive${name}Service = new Archive${name}Service(unitOfWork);
    this.handlers.set("archive${name}", {
      parse: (p) => Archive${name}Command.parse(p),
      execute: (c) => archive${name}Service.execute(c as Archive${name}Command),
    });`;

  if (config.includeStatusWorkflow) {
    handlers += `

    const publish${name}Service = new Publish${name}Service(unitOfWork);
    this.handlers.set("publish${name}", {
      parse: (p) => Publish${name}Command.parse(p),
      execute: (c) => publish${name}Service.execute(c as Publish${name}Command),
    });

    const unpublish${name}Service = new Unpublish${name}Service(unitOfWork);
    this.handlers.set("unpublish${name}", {
      parse: (p) => Unpublish${name}Command.parse(p),
      execute: (c) => unpublish${name}Service.execute(c as Unpublish${name}Command),
    });`;
  }

  // Find the end of setDefaultVariant handler and add after it
  content = insertAfter(content, `execute: (c) => setDefaultVariantService.execute(c as SetDefaultVariantCommand),
    });`, handlers);

  await writeFileContent(filePath, content);
}

async function wireProjectorDispatcher(basePath: string, config: AggregateConfig): Promise<void> {
  const { nameCamel, namePlural, namePluralCamel } = config;
  const filePath = join(basePath, "infrastructure/routers/projectorDispatcher.ts");
  let content = await readFileContent(filePath);

  // 1. Add projector import
  const projectorImport = `\nimport { ${namePlural}Projector } from "../projections/${nameCamel}/${namePluralCamel}Projector";`;
  content = insertAfter(content, `import { ProductVariantsProjector } from "../projections/productVariant/productVariantsProjector";`, projectorImport);

  // 2. Add to projectors array
  const projectorEntry = `\n            new ${namePlural}Projector(repositories),`;
  content = insertAfter(content, `new ProductVariantsProjector(repositories),`, projectorEntry);

  await writeFileContent(filePath, content);
}

async function performAutoWiring(basePath: string, config: AggregateConfig): Promise<void> {
  console.log("\nAuto-wiring:");

  try {
    await wireEventTypes(basePath, config);
    console.log("  ✓ src/api/domain/_base/domainEvent.ts (added EventType + DomainEventUnion)");
  } catch (error) {
    console.log(`  ✗ src/api/domain/_base/domainEvent.ts: ${error}`);
  }

  try {
    await wireCommandTypes(basePath, config);
    console.log("  ✓ src/api/app/command.ts (added CommandType entries)");
  } catch (error) {
    console.log(`  ✗ src/api/app/command.ts: ${error}`);
  }

  try {
    await wireSchemas(basePath, config);
    console.log("  ✓ src/api/infrastructure/schemas.ts (added read model schema)");
  } catch (error) {
    console.log(`  ✗ src/api/infrastructure/schemas.ts: ${error}`);
  }

  try {
    await wireUnitOfWork(basePath, config);
    console.log("  ✓ src/api/infrastructure/unitOfWork.ts (added repository wiring)");
  } catch (error) {
    console.log(`  ✗ src/api/infrastructure/unitOfWork.ts: ${error}`);
  }

  try {
    await wireAdminCommandsRouter(basePath, config);
    console.log("  ✓ src/api/infrastructure/routers/adminCommandsRouter.ts (added command handlers)");
  } catch (error) {
    console.log(`  ✗ src/api/infrastructure/routers/adminCommandsRouter.ts: ${error}`);
  }

  try {
    await wireProjectorDispatcher(basePath, config);
    console.log("  ✓ src/api/infrastructure/routers/projectorDispatcher.ts (added projector)");
  } catch (error) {
    console.log(`  ✗ src/api/infrastructure/routers/projectorDispatcher.ts: ${error}`);
  }
}

// =============================================================================
// Wiring Instructions Generator (deprecated - kept for reference)
// =============================================================================

function generateWiringInstructions(config: AggregateConfig): string {
  const { name, nameCamel, namePlural, namePluralCamel } = config;
  const eventTypes = getEventTypes(config);

  const eventTypeUnion = eventTypes.map(t => `"${nameCamel}.${t.toLowerCase()}"`).join(" | ");
  const commandTypes = [`"create${name}"`, `"archive${name}"`];
  if (config.includeStatusWorkflow) {
    commandTypes.push(`"publish${name}"`, `"unpublish${name}"`);
  }
  const commandTypeUnion = commandTypes.join(" | ");

  const schemaColumns = generateSchemaColumns(config);

  return `
=== Manual Wiring Required ===

1. Add to src/api/domain/_base/domainEvent.ts:

   In EventType union, add:
   | ${eventTypeUnion}

   In DomainEventUnion, add:
   | import("../${nameCamel}/events").${name}Event

2. Add to src/api/app/command.ts:

   In CommandType union, add:
   | ${commandTypeUnion}

3. Add to src/api/infrastructure/schemas.ts:

   Add this schema to the schemas array:
   \`CREATE TABLE IF NOT EXISTS ${nameCamel}ReadModel (
    aggregateId TEXT PRIMARY KEY,
    correlationId TEXT NOT NULL,
    version INTEGER NOT NULL,${schemaColumns}
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL${config.includeStatusWorkflow ? `,
    status TEXT NOT NULL DEFAULT 'draft',
    publishedAt TEXT` : ""}
  )\`,
  \`CREATE INDEX IF NOT EXISTS idx_${nameCamel}ReadModel_status ON ${nameCamel}ReadModel(status)\`,

4. Add to src/api/infrastructure/unitOfWork.ts:

   Import:
   import { ${namePlural}ReadModelRepository } from "./repositories/readModels/${namePluralCamel}ReadModelRepository";

   In UnitOfWorkRepositories type, add:
   ${namePluralCamel}ReadModelRepository: ${namePlural}ReadModelRepository;

   In UnitOfWork class, add factory property:
   private ${namePlural}ReadModelRepositoryFactory: typeof ${namePlural}ReadModelRepository;

   In constructor, add:
   this.${namePlural}ReadModelRepositoryFactory = ${namePlural}ReadModelRepository;

   In withTransaction, add:
   const ${namePluralCamel}ReadModelRepository = new this.${namePlural}ReadModelRepositoryFactory(this.db, batch);

   In repositories object, add:
   ${namePluralCamel}ReadModelRepository,

5. Add to src/api/infrastructure/routers/adminCommandsRouter.ts:

   Import services:
   import { Create${name}Service } from "../../app/${nameCamel}/commands/admin/create${name}Service";
   import { Archive${name}Service } from "../../app/${nameCamel}/commands/admin/archive${name}Service";${config.includeStatusWorkflow ? `
   import { Publish${name}Service } from "../../app/${nameCamel}/commands/admin/publish${name}Service";
   import { Unpublish${name}Service } from "../../app/${nameCamel}/commands/admin/unpublish${name}Service";` : ""}

   Import commands:
   import {
     Create${name}Command,
     Archive${name}Command,${config.includeStatusWorkflow ? `
     Publish${name}Command,
     Unpublish${name}Command,` : ""}
   } from "../../app/${nameCamel}/commands/admin/commands";

   In initializeHandlers, add:
   const create${name}Service = new Create${name}Service(unitOfWork);
   this.handlers.set("create${name}", {
     parse: (p) => Create${name}Command.parse(p),
     execute: (c) => create${name}Service.execute(c as Create${name}Command),
   });

   const archive${name}Service = new Archive${name}Service(unitOfWork);
   this.handlers.set("archive${name}", {
     parse: (p) => Archive${name}Command.parse(p),
     execute: (c) => archive${name}Service.execute(c as Archive${name}Command),
   });${config.includeStatusWorkflow ? `

   const publish${name}Service = new Publish${name}Service(unitOfWork);
   this.handlers.set("publish${name}", {
     parse: (p) => Publish${name}Command.parse(p),
     execute: (c) => publish${name}Service.execute(c as Publish${name}Command),
   });

   const unpublish${name}Service = new Unpublish${name}Service(unitOfWork);
   this.handlers.set("unpublish${name}", {
     parse: (p) => Unpublish${name}Command.parse(p),
     execute: (c) => unpublish${name}Service.execute(c as Unpublish${name}Command),
   });` : ""}

6. Add to src/api/infrastructure/routers/projectorDispatcher.ts:

   Import:
   import { ${namePlural}Projector } from "../projections/${nameCamel}/${namePluralCamel}Projector";

   In projectors array, add:
   new ${namePlural}Projector(repositories),

Done! Run 'bunx tsc --noEmit' to verify type safety.
`;
}

function generateSchemaColumns(config: AggregateConfig): string {
  return config.attributes.map(attr => {
    const sqlType = toSqlType(attr);
    const nullable = attr.isOptional ? "" : " NOT NULL";
    const defaultVal = attr.isArray ? " DEFAULT '[]'" : "";
    return `\n    ${attr.name} ${sqlType}${nullable}${defaultVal},`;
  }).join("");
}

// =============================================================================
// File Writer
// =============================================================================

async function writeGeneratedFile(basePath: string, relativePath: string, content: string): Promise<void> {
  const fullPath = join(basePath, relativePath);
  const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));

  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  await writeFile(fullPath, content);
  console.log(`  Created: ${relativePath}`);
}

// =============================================================================
// Interactive CLI
// =============================================================================

async function main() {
  const basePath = join(import.meta.dir, "../src/api");

  console.log("\n=== SlapCommerce Aggregate Generator ===\n");

  // Get aggregate name
  const nameInput = prompt("Enter aggregate name (PascalCase):");
  if (!nameInput || nameInput.trim() === "") {
    console.error("Error: Aggregate name is required");
    process.exit(1);
  }

  const name = toPascalCase(nameInput.trim());
  const nameCamel = toCamelCase(name);
  const namePlural = pluralize(name);
  const namePluralCamel = toCamelCase(namePlural);

  // Check if aggregate already exists
  const domainPath = join(basePath, `domain/${nameCamel}`);
  if (existsSync(domainPath)) {
    console.error(`Error: Aggregate "${name}" already exists at ${domainPath}`);
    process.exit(1);
  }

  // Status workflow
  const statusInput = prompt("Include status workflow (draft/active/archived with publish/unpublish)? (Y/n):");
  const includeStatusWorkflow = !statusInput || statusInput.toLowerCase() !== "n";

  // Collect attributes
  console.log("\nAdd custom attributes (enter empty name when done):");
  console.log("Supported types: string, number, boolean, Date, string[], number[], enum:a,b,c, optional:TYPE\n");

  const attributes: Attribute[] = [];
  while (true) {
    const attrName = prompt("  Attribute name:");
    if (!attrName || attrName.trim() === "") {
      break;
    }

    const attrType = prompt("  Attribute type:");
    if (!attrType || attrType.trim() === "") {
      console.log("  Skipping attribute without type");
      continue;
    }

    const parsed = parseAttributeType(attrType.trim());
    attributes.push({
      name: attrName.trim(),
      ...parsed,
    });
    console.log("");
  }

  // Build config
  const config: AggregateConfig = {
    name,
    nameCamel,
    namePlural,
    namePluralCamel,
    includeStatusWorkflow,
    attributes,
  };

  // Show summary
  console.log(`\nGenerating aggregate "${name}" with:`);
  console.log(`  Status workflow: ${includeStatusWorkflow ? "Yes" : "No"}`);
  if (attributes.length > 0) {
    console.log("  Custom attributes:");
    for (const attr of attributes) {
      let typeDisplay = attr.baseType;
      if (attr.isEnum && attr.enumValues) {
        typeDisplay = `enum(${attr.enumValues.join(",")})`;
      }
      if (attr.isArray) {
        typeDisplay += "[]";
      }
      if (attr.isOptional) {
        typeDisplay += " (optional)";
      }
      console.log(`    - ${attr.name}: ${typeDisplay}`);
    }
  } else {
    console.log("  Custom attributes: None");
  }

  // Confirm
  const confirmInput = prompt("\nConfirm generation? (Y/n):");
  if (confirmInput && confirmInput.toLowerCase() === "n") {
    console.log("Generation cancelled.");
    process.exit(0);
  }

  // Generate files
  console.log("\nCreating files:");

  // Domain layer
  await writeGeneratedFile(basePath, `domain/${nameCamel}/events.ts`, generateEvents(config));
  await writeGeneratedFile(basePath, `domain/${nameCamel}/aggregate.ts`, generateAggregate(config));

  // App layer - commands
  await writeGeneratedFile(basePath, `app/${nameCamel}/commands/admin/commands.ts`, generateCommands(config));
  await writeGeneratedFile(basePath, `app/${nameCamel}/commands/admin/create${name}Service.ts`, generateCreateService(config));
  await writeGeneratedFile(basePath, `app/${nameCamel}/commands/admin/archive${name}Service.ts`, generateArchiveService(config));

  if (includeStatusWorkflow) {
    await writeGeneratedFile(basePath, `app/${nameCamel}/commands/admin/publish${name}Service.ts`, generatePublishService(config));
    await writeGeneratedFile(basePath, `app/${nameCamel}/commands/admin/unpublish${name}Service.ts`, generateUnpublishService(config));
  }

  // Infrastructure layer
  await writeGeneratedFile(basePath, `infrastructure/repositories/readModels/${namePluralCamel}ReadModelRepository.ts`, generateReadModelRepository(config));
  await writeGeneratedFile(basePath, `infrastructure/projections/${nameCamel}/${namePluralCamel}Projector.ts`, generateProjector(config));

  // Perform auto-wiring
  await performAutoWiring(basePath, config);

  console.log("\nDone! Run 'bunx tsc --noEmit' to verify type safety.");
}

main().catch(console.error);
