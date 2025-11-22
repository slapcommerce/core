import type { AggregateConfig } from "../utils/prompts";
import { toCamelCase } from "../utils/templates";
import { addImportStatement, addToUnionType } from "../utils/fileWriter";

export async function updateInfrastructureLayer(config: AggregateConfig): Promise<void> {
  const { name } = config;
  const camelName = toCamelCase(name);

  console.log("\n📦 Updating infrastructure layer...");

  // Update domain event types
  await updateDomainEventTypes(config);

  // Update command types
  await updateCommandTypes(config);

  // Update admin commands router
  await updateAdminCommandsRouter(config);
}

async function updateDomainEventTypes(config: AggregateConfig): Promise<void> {
  const { name } = config;
  const camelName = toCamelCase(name);
  const filePath = "/Users/ryanwible/projects/core/src/domain/_base/domainEvent.ts";

  // Add event type to EventType union
  const file = Bun.file(filePath);
  let content = await file.text();

  // Find the EventType union
  const eventTypeMatch = content.match(/export type EventType =([^;]+);/s);
  if (!eventTypeMatch) {
    throw new Error("Could not find EventType union");
  }

  // Add comment and event types before the last item
  const eventTypeContent = eventTypeMatch[1];
  const lastPipeIndex = eventTypeContent.lastIndexOf("|");

  const newEventTypes = `  // ${name} events
  | "${camelName}.created"
  `;

  const updatedEventType =
    eventTypeContent.slice(0, lastPipeIndex) +
    newEventTypes +
    eventTypeContent.slice(lastPipeIndex);

  content = content.replace(
    /export type EventType =([^;]+);/s,
    `export type EventType =${updatedEventType};`
  );

  // Add to DomainEventUnion
  const unionMatch = content.match(/export type DomainEventUnion =([^;]+);/s);
  if (!unionMatch) {
    throw new Error("Could not find DomainEventUnion");
  }

  const unionContent = unionMatch[1];
  const updatedUnion = unionContent.trimEnd() + `\n  | import("../${camelName}/events").${name}Event`;

  content = content.replace(
    /export type DomainEventUnion =([^;]+);/s,
    `export type DomainEventUnion =${updatedUnion};`
  );

  await Bun.write(filePath, content);
  console.log(`  ✅ Updated: ${filePath}`);
}

async function updateCommandTypes(config: AggregateConfig): Promise<void> {
  const { name } = config;
  const camelName = toCamelCase(name);
  const filePath = "/Users/ryanwible/projects/core/src/app/command.ts";

  const file = Bun.file(filePath);
  let content = await file.text();

  // Add to CommandType union
  const commandTypeMatch = content.match(/export type CommandType =([^;]+);/s);
  if (!commandTypeMatch) {
    throw new Error("Could not find CommandType union");
  }

  const commandTypeContent = commandTypeMatch[1];
  const lastPipeIndex = commandTypeContent.lastIndexOf("|");

  const newCommandType = `\n    | "create${name}"`;

  const updatedCommandType =
    commandTypeContent.slice(0, lastPipeIndex) +
    newCommandType +
    commandTypeContent.slice(lastPipeIndex);

  content = content.replace(
    /export type CommandType =([^;]+);/s,
    `export type CommandType =${updatedCommandType};`
  );

  await Bun.write(filePath, content);
  console.log(`  ✅ Updated: ${filePath}`);
}

async function updateAdminCommandsRouter(config: AggregateConfig): Promise<void> {
  const { name } = config;
  const camelName = toCamelCase(name);
  const filePath = "/Users/ryanwible/projects/core/src/infrastructure/routers/adminCommandsRouter.ts";

  const file = Bun.file(filePath);
  let content = await file.text();

  // Add service import
  const serviceImport = `import { Create${name}Service } from "../../app/${camelName}/create${name}Service";`;
  const lastServiceImportMatch = content.match(/import.*Service.*from.*\n/g);
  if (lastServiceImportMatch) {
    const lastImport = lastServiceImportMatch[lastServiceImportMatch.length - 1];
    const lastImportIndex = content.lastIndexOf(lastImport);
    content = content.slice(0, lastImportIndex + lastImport.length) + serviceImport + "\n" + content.slice(lastImportIndex + lastImport.length);
  }

  // Add command import
  const commandImport = `import {
  Create${name}Command,
} from "../../app/${camelName}/commands";`;

  // Find where to insert command imports (after existing command imports)
  const lastCommandImportMatch = content.match(/import \{[^}]+\} from "\.\.\/\.\.\/app\/\w+\/commands";/g);
  if (lastCommandImportMatch) {
    const lastImport = lastCommandImportMatch[lastCommandImportMatch.length - 1];
    const lastImportIndex = content.lastIndexOf(lastImport);
    content = content.slice(0, lastImportIndex + lastImport.length) + "\n" + commandImport + content.slice(lastImportIndex + lastImport.length);
  }

  // Add service instantiation
  const serviceInstantiation = `  const create${name}Service = new Create${name}Service(
    unitOfWork,

  );`;

  // Find where to insert (before the return statement)
  const returnMatch = content.match(/\n  return async \(type: CommandType/);
  if (!returnMatch || returnMatch.index === undefined) {
    throw new Error("Could not find return statement in admin commands router");
  }

  content = content.slice(0, returnMatch.index) + "\n" + serviceInstantiation + "\n" + content.slice(returnMatch.index);

  // Add switch case
  const switchCase = `        case "create${name}": {
          const command = Create${name}Command.parse({ ...(payload as any) });
          await create${name}Service.execute(command);
          break;
        }`;

  // Find where to insert (after the first switch case)
  const firstCaseMatch = content.match(/case "createProduct": \{[^}]+\}[^}]+\}/s);
  if (firstCaseMatch && firstCaseMatch.index !== undefined) {
    const insertIndex = firstCaseMatch.index + firstCaseMatch[0].length;
    content = content.slice(0, insertIndex) + "\n        " + switchCase + content.slice(insertIndex);
  }

  await Bun.write(filePath, content);
  console.log(`  ✅ Updated: ${filePath}`);
}
