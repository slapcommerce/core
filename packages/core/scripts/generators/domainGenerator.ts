import type { AggregateConfig } from "../utils/prompts";
import { writeFile } from "../utils/fileWriter";
import {
  toCamelCase,
  generateStateTypeFields,
  generateConstructorParams,
  generateCreateParams,
  generatePrivateFields,
  generateConstructorAssignments,
  generateCreateInitialization,
  generateToStateReturn,
  generateSnapshotFields,
  generateLoadFromSnapshotAssignments,
} from "../utils/templates";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CORE_ROOT = join(__dirname, "../..");
const SRC_ROOT = join(CORE_ROOT, "src", "api");

export async function generateDomainLayer(config: AggregateConfig): Promise<void> {
  const { name, fields, includeStatus } = config;
  const camelName = toCamelCase(name);

  console.log("\n📦 Generating domain layer...");

  // Generate events.ts
  await generateEventsFile(config);

  // Generate aggregate.ts
  await generateAggregateFile(config);
}

async function generateEventsFile(config: AggregateConfig): Promise<void> {
  const { name, fields, includeStatus } = config;
  const camelName = toCamelCase(name);

  const stateFields = generateStateTypeFields(fields, includeStatus);

  const content = `import type { DomainEvent, StateBasedPayload } from "../_base/domainEvent";

export type ${name}State = {
${stateFields}
};

type ${name}CreatedEventParams = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ${name}State;
  newState: ${name}State;
};

export class ${name}CreatedEvent implements DomainEvent {
  occurredAt: Date;
  eventName = "${camelName}.created" as const;
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
  }: ${name}CreatedEventParams) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}

export type ${name}Event = ${name}CreatedEvent;
`;

  const filePath = join(SRC_ROOT, "domain", camelName, "events.ts");
  await writeFile(filePath, content);
}

async function generateAggregateFile(config: AggregateConfig): Promise<void> {
  const { name, fields, includeStatus } = config;
  const camelName = toCamelCase(name);

  const constructorParams = generateConstructorParams(fields, includeStatus);
  const createParams = generateCreateParams(fields);
  const privateFields = generatePrivateFields(fields, includeStatus);
  const constructorAssignments = generateConstructorAssignments(fields, includeStatus);
  const createInitialization = generateCreateInitialization(fields, includeStatus);
  const toStateReturn = generateToStateReturn(fields, includeStatus);
  const snapshotFields = generateSnapshotFields(fields, includeStatus);
  const loadFromSnapshotAssignments = generateLoadFromSnapshotAssignments(fields, includeStatus);

  const content = `import type { DomainEvent } from "../_base/domainEvent";
import { ${name}CreatedEvent, type ${name}State } from "./events";

type ${name}AggregateParams = {
${constructorParams}
};

type Create${name}AggregateParams = {
${createParams}
};

export class ${name}Aggregate {
  public id: string;
  public version: number = 0;
  public events: DomainEvent[];
  public uncommittedEvents: DomainEvent[] = [];
${privateFields}

  constructor({
    id,
    correlationId,
    createdAt,
    updatedAt,
    version = 0,
    events,
${includeStatus ? "    status," : ""}
${fields.map((f) => `    ${f.name},`).join("\n")}
  }: ${name}AggregateParams) {
${constructorAssignments}
  }

  static create({
    id,
    correlationId,
    userId,
${fields
  .filter((f) => !f.optional)
  .map((f) => `    ${f.name},`)
  .join("\n")}
  }: Create${name}AggregateParams) {
    const createdAt = new Date();
    const aggregate = new ${name}Aggregate({
${createInitialization}
    });

    const priorState = {} as ${name}State;
    const newState = aggregate.toState();
    const createdEvent = new ${name}CreatedEvent({
      occurredAt: createdAt,
      correlationId,
      aggregateId: id,
      version: 0,
      userId,
      priorState,
      newState,
    });
    aggregate.uncommittedEvents.push(createdEvent);
    return aggregate;
  }

  private toState(): ${name}State {
    return {
${toStateReturn}
    };
  }

  static loadFromSnapshot(snapshot: {
    aggregateId: string;
    correlationId: string;
    version: number;
    payload: string;
  }) {
    const payload = JSON.parse(snapshot.payload);
    return new ${name}Aggregate({
${loadFromSnapshotAssignments}
    });
  }

  toSnapshot() {
    return {
${snapshotFields}
      version: this.version,
    };
  }
}
`;

  const filePath = join(SRC_ROOT, "domain", camelName, "aggregate.ts");
  await writeFile(filePath, content);
}
