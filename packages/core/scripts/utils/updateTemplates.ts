import type { UpdateMethodConfig, UpdateFieldConfig } from "./updatePrompts";
import { toCamelCase, toKebabCase } from "./templates";

export function generateEventName(aggregateName: string, methodName: string): string {
  // Convert to snake_case for event name
  const kebab = toKebabCase(aggregateName + methodName.charAt(0).toUpperCase() + methodName.slice(1));
  return `${toCamelCase(aggregateName)}.${kebab.split("-").slice(1).join("_")}`;
}

export function generateEventClass(config: UpdateMethodConfig): string {
  const { aggregateName, methodName, eventName } = config;
  const camelAggregate = toCamelCase(aggregateName);
  const snakeCaseEventName = generateEventName(aggregateName, methodName);

  return `type ${eventName}Params = {
  occurredAt: Date;
  aggregateId: string;
  correlationId: string;
  version: number;
  userId: string;
  priorState: ${aggregateName}State;
  newState: ${aggregateName}State;
};

export class ${eventName} implements DomainEvent {
  occurredAt: Date;
  eventName = "${snakeCaseEventName}" as const;
  correlationId: string;
  aggregateId: string;
  version: number;
  userId: string;
  payload: StateBasedPayload<${aggregateName}State>;

  constructor({ occurredAt, aggregateId, correlationId, version, userId, priorState, newState }: ${eventName}Params) {
    this.occurredAt = occurredAt;
    this.correlationId = correlationId;
    this.aggregateId = aggregateId;
    this.version = version;
    this.userId = userId;
    this.payload = { priorState, newState };
  }
}`;
}

export function generateAggregateMethod(config: UpdateMethodConfig): string {
  const { methodName, eventName, fields, affectedFields } = config;

  // Generate method parameters
  const params = [
    ...fields.map(f => `${f.name}: ${f.type}`),
    "userId: string"
  ];

  // Generate field assignments
  const assignments = affectedFields.map(field => `    this.${field} = ${field};`).join("\n");

  return `  ${methodName}(
    ${params.join(",\n    ")}
  ) {
    const occurredAt = new Date();
    // Capture prior state before mutation
    const priorState = this.toState();
    // Mutate state
${assignments}
    this.updatedAt = occurredAt;
    this.version++;
    // Capture new state and emit event
    const newState = this.toState();
    const event = new ${eventName}({
      occurredAt,
      correlationId: this.correlationId,
      aggregateId: this.id,
      version: this.version,
      userId,
      priorState,
      newState,
    });
    this.uncommittedEvents.push(event);
    return this;
  }`;
}

export function generateCommandSchema(config: UpdateMethodConfig): string {
  const { commandName, commandType, fields } = config;

  const zodFields = fields.map(f => `  ${f.name}: ${f.zodValidation},`).join("\n");

  return `export const ${commandName} = z.object({
  id: z.uuidv7(),
  type: z.literal("${commandType}"),
  userId: z.string(),
${zodFields}
  expectedVersion: z.number().int().nonnegative(),
});

export type ${commandName} = z.infer<typeof ${commandName}>;`;
}

export function generateServiceClass(config: UpdateMethodConfig): string {
  const { aggregateName, aggregateCamelName, methodName, commandName, accessLevel, fields } = config;

  const methodArgs = fields.map(f => `command.${f.name}`).join(",\n        ");

  return `import type { UnitOfWork } from "../../infrastructure/unitOfWork";
import type { ${commandName} } from "./commands";
import { ${aggregateName}Aggregate } from "../../domain/${aggregateCamelName}/aggregate";
import { randomUUIDv7 } from "bun";
import type { AccessLevel } from "../accessLevel";
import type { Service } from "../service";

export class ${commandName.replace("Command", "Service")} implements Service<${commandName}> {
  accessLevel: AccessLevel = "${accessLevel}";

  constructor(private unitOfWork: UnitOfWork) {
    this.unitOfWork = unitOfWork;
  }

  async execute(command: ${commandName}) {
    return await this.unitOfWork.withTransaction(async (repositories) => {
      const { eventRepository, snapshotRepository, outboxRepository } = repositories;
      const snapshot = snapshotRepository.getSnapshot(command.id);
      if (!snapshot) {
        throw new Error(\`${aggregateName} with id \${command.id} not found\`);
      }
      if (snapshot.version !== command.expectedVersion) {
        throw new Error(
          \`Optimistic concurrency conflict: expected version \${command.expectedVersion} but found version \${snapshot.version}\`,
        );
      }
      const aggregate = ${aggregateName}Aggregate.loadFromSnapshot(snapshot);
      aggregate.${methodName}(
        ${methodArgs},
        command.userId,
      );

      for (const event of aggregate.uncommittedEvents) {
        eventRepository.addEvent(event);
      }

      snapshotRepository.saveSnapshot({
        aggregateId: aggregate.id,
        correlationId: snapshot.correlationId,
        version: aggregate.version,
        payload: aggregate.toSnapshot(),
      });

      for (const event of aggregate.uncommittedEvents) {
        outboxRepository.addOutboxEvent(event, { id: randomUUIDv7() });
      }
    });
  }
}
`;
}

export function generateTestFile(config: UpdateMethodConfig): string {
  const { aggregateName, aggregateCamelName, methodName, fields, affectedFields } = config;

  // Generate test values for each field
  const testValues = fields.map(f => {
    if (f.type === "string") return `"updated value"`;
    if (f.type === "number") return "100";
    if (f.type === "boolean") return "true";
    if (f.type === "Date") return "new Date()";
    if (f.type === "string[]") return `["item1", "item2"]`;
    if (f.type === "number[]") return "[1, 2, 3]";
    // Check if it's an enum (contains | character)
    if (f.type.includes("|")) {
      // Extract first enum value (e.g., "pending" from '"pending" | "executed"')
      const firstValue = f.type.split("|")[0]!.trim().replace(/"/g, "");
      return `"${firstValue}"`;
    }
    // For unknown types, use null with a comment
    return `null /* TODO: Provide test value for ${f.name}: ${f.type} */`;
  });

  const methodCallArgs = fields.map((f, i) => testValues[i]).join(", ");
  const assertions = affectedFields.map((field, i) => {
    const value = testValues[i];
    if (field === "updatedAt") return ""; // Skip updatedAt
    // Skip assertions for null values (unknown types)
    if (value!.startsWith("null")) return "";
    return `  expect(state.${field}).toEqual(${value});`;
  }).filter(a => a).join("\n");

  return `import { test, expect } from "bun:test";
import { ${aggregateName}Aggregate } from "../../../src/api/domain/${aggregateCamelName}/aggregate";
import { randomUUIDv7 } from "bun";

test("should ${methodName}", () => {
  // Arrange
  const id = randomUUIDv7();
  const correlationId = randomUUIDv7();
  const userId = randomUUIDv7();

  // Create aggregate first - check ${aggregateName}Aggregate.create() signature for required parameters
  const aggregate = ${aggregateName}Aggregate.create({
    id,
    correlationId,
    userId,
    // TODO: Add additional required parameters (check the aggregate's create method)
  });

  // Act
  aggregate.${methodName}(${methodCallArgs}, userId);

  // Assert
  const state = aggregate.toSnapshot();
${assertions}
  expect(aggregate.uncommittedEvents).toHaveLength(2); // Created + Updated
  expect(aggregate.version).toBe(1);
});

test("should increment version when ${methodName}", () => {
  // Arrange
  const id = randomUUIDv7();
  const correlationId = randomUUIDv7();
  const userId = randomUUIDv7();

  const aggregate = ${aggregateName}Aggregate.create({
    id,
    correlationId,
    userId,
    // TODO: Add additional required parameters (check the aggregate's create method)
  });

  const initialVersion = aggregate.version;

  // Act
  aggregate.${methodName}(${methodCallArgs}, userId);

  // Assert
  expect(aggregate.version).toBe(initialVersion + 1);
});

test("should capture prior and new state in event", () => {
  // Arrange
  const id = randomUUIDv7();
  const correlationId = randomUUIDv7();
  const userId = randomUUIDv7();

  const aggregate = ${aggregateName}Aggregate.create({
    id,
    correlationId,
    userId,
    // TODO: Add additional required parameters (check the aggregate's create method)
  });

  // Act
  aggregate.${methodName}(${methodCallArgs}, userId);

  // Assert
  const event = aggregate.uncommittedEvents[1]; // Second event after create
  expect(event.payload.priorState).toBeDefined();
  expect(event.payload.newState).toBeDefined();
  expect(event.payload.priorState).not.toEqual(event.payload.newState);
});
`;
}
