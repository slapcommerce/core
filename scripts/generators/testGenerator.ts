import type { AggregateConfig } from "../utils/prompts";
import { writeFile } from "../utils/fileWriter";
import { toCamelCase, getTypeScriptDefault } from "../utils/templates";

export async function generateTests(config: AggregateConfig): Promise<void> {
  const { name } = config;

  console.log("\n📦 Generating tests...");

  // Generate aggregate test
  await generateAggregateTest(config);
}

async function generateAggregateTest(config: AggregateConfig): Promise<void> {
  const { name, fields, includeStatus } = config;
  const camelName = toCamelCase(name);

  // Generate valid params function
  const paramFields = [
    "    id: randomUUIDv7(),",
    "    correlationId: randomUUIDv7(),",
    "    userId: randomUUIDv7(),",
  ];

  fields
    .filter((f) => !f.optional)
    .forEach((f) => {
      let value = getTypeScriptDefault(f.type, false);
      if (f.type === "string") {
        value = `'Test ${f.name}'`;
      }
      paramFields.push(`    ${f.name}: ${value},`);
    });

  const assertFields = fields
    .filter((f) => !f.optional)
    .map((f) => {
      return `      expect(snapshot.${f.name}).toBe(params.${f.name})`;
    })
    .join("\n");

  const statusAssertion = includeStatus
    ? `      expect(snapshot.status).toBe('draft')`
    : "";

  const content = `import { describe, test, expect } from 'bun:test'
import { randomUUIDv7 } from 'bun'
import { ${name}Aggregate } from '../../../src/domain/${camelName}/aggregate'
import { ${name}CreatedEvent } from '../../../src/domain/${camelName}/events'

function createValid${name}Params() {
  return {
${paramFields.join("\n")}
  }
}

describe('${name}Aggregate', () => {
  describe('create', () => {
    test('should create a new ${camelName} aggregate', () => {
      // Arrange
      const params = createValid${name}Params()

      // Act
      const ${camelName} = ${name}Aggregate.create(params)

      // Assert
      const snapshot = ${camelName}.toSnapshot()
      expect(${camelName}.id).toBe(params.id)
${assertFields}
${statusAssertion}
      expect(${camelName}.version).toBe(0)
      expect(${camelName}.events).toEqual([])
      expect(${camelName}.uncommittedEvents).toHaveLength(1)

      const event = ${camelName}.uncommittedEvents[0]!
      expect(event).toBeInstanceOf(${name}CreatedEvent)
      expect(event.eventName).toBe('${camelName}.created')
      expect(event.aggregateId).toBe(params.id)
      expect(event.correlationId).toBe(params.correlationId)
      expect(event.version).toBe(0)
    })

    test('should set createdAt and updatedAt to current time', () => {
      // Arrange
      const params = createValid${name}Params()
      const beforeCreate = new Date()

      // Act
      const ${camelName} = ${name}Aggregate.create(params)
      const afterCreate = new Date()

      // Assert
      const snapshot = ${camelName}.toSnapshot()
      expect(snapshot.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime())
      expect(snapshot.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime())
      expect(snapshot.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime())
      expect(snapshot.updatedAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime())
      expect(snapshot.createdAt.getTime()).toBe(snapshot.updatedAt.getTime())
    })

    test('should include all ${camelName} data in created event payload', () => {
      // Arrange
      const params = createValid${name}Params()

      // Act
      const ${camelName} = ${name}Aggregate.create(params)

      // Assert
      const event = ${camelName}.uncommittedEvents[0] as ${name}CreatedEvent
      expect(event.payload.priorState).toEqual({})
      expect(event.payload.newState.id).toBe(params.id)
      expect(event.payload.newState.correlationId).toBe(params.correlationId)
${fields
  .filter((f) => !f.optional)
  .map((f) => `      expect(event.payload.newState.${f.name}).toBe(params.${f.name})`)
  .join("\n")}
    })
  })

  describe('loadFromSnapshot', () => {
    test('should load aggregate from snapshot', () => {
      // Arrange
      const params = createValid${name}Params()
      const original${name} = ${name}Aggregate.create(params)
      const snapshot = {
        aggregate_id: original${name}.id,
        correlation_id: params.correlationId,
        version: 0,
        payload: JSON.stringify(original${name}.toSnapshot()),
      }

      // Act
      const loaded${name} = ${name}Aggregate.loadFromSnapshot(snapshot)

      // Assert
      const loadedSnapshot = loaded${name}.toSnapshot()
      const originalSnapshot = original${name}.toSnapshot()
      expect(loadedSnapshot.id).toBe(originalSnapshot.id)
      expect(loadedSnapshot.correlationId).toBe(originalSnapshot.correlationId)
${fields
  .filter((f) => !f.optional)
  .map((f) => `      expect(loadedSnapshot.${f.name}).toEqual(originalSnapshot.${f.name})`)
  .join("\n")}
    })
  })
})
`;

  const filePath = `/Users/ryanwible/projects/core/tests/domain/${camelName}/aggregate.test.ts`;
  await writeFile(filePath, content);
}
