import type { AggregateConfig } from "../utils/prompts";
import { toCamelCase } from "../utils/templates";
import { addImportStatement, addToUnionType } from "../utils/fileWriter";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CORE_ROOT = join(__dirname, "../..");
const SRC_ROOT = join(CORE_ROOT, "src");

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
  const filePath = join(SRC_ROOT, "domain", "_base", "domainEvent.ts");

  const file = Bun.file(filePath);
  let content = await file.text();

  // Add event types to EventType union at the end
  const eventTypeMatch = content.match(/export type EventType =([^;]+);/s);
  if (!eventTypeMatch) {
    throw new Error("Could not find EventType union");
  }

  const eventTypeContent = eventTypeMatch[1];
  if (eventTypeContent === undefined) {
    throw new Error("EventType content is undefined");
  }
  // Remove trailing whitespace and add new event types before the semicolon
  const trimmedContent = eventTypeContent.trimEnd();
  const newEventTypes = `\n  // ${name} events\n  | "${camelName}.created"`;

  content = content.replace(
    /export type EventType =([^;]+);/s,
    `export type EventType =${trimmedContent}${newEventTypes};`
  );

  // Add to DomainEventUnion at the end
  const unionMatch = content.match(/export type DomainEventUnion =([^;]+);/s);
  if (!unionMatch) {
    throw new Error("Could not find DomainEventUnion");
  }

  const unionContent = unionMatch[1];
  if (unionContent === undefined) {
    throw new Error("DomainEventUnion content is undefined");
  }
  const trimmedUnion = unionContent.trimEnd();
  const newUnion = `\n  | import("../${camelName}/events").${name}Event`;

  content = content.replace(
    /export type DomainEventUnion =([^;]+);/s,
    `export type DomainEventUnion =${trimmedUnion}${newUnion};`
  );

  await Bun.write(filePath, content);
  console.log(`  ✅ Updated: ${filePath}`);
}

async function updateCommandTypes(config: AggregateConfig): Promise<void> {
  const { name } = config;
  const camelName = toCamelCase(name);
  const filePath = join(SRC_ROOT, "app", "command.ts");

  const file = Bun.file(filePath);
  let content = await file.text();

  // Add to CommandType union at the end
  const commandTypeMatch = content.match(/export type CommandType =([^;]+);/s);
  if (!commandTypeMatch) {
    throw new Error("Could not find CommandType union");
  }

  const commandTypeContent = commandTypeMatch[1];
  if (commandTypeContent === undefined) {
    throw new Error("CommandType content is undefined");
  }
  const trimmedContent = commandTypeContent.trimEnd();
  const newCommandType = `\n    | "create${name}"`;

  content = content.replace(
    /export type CommandType =([^;]+);/s,
    `export type CommandType =${trimmedContent}${newCommandType};`
  );

  await Bun.write(filePath, content);
  console.log(`  ✅ Updated: ${filePath}`);
}

async function updateAdminCommandsRouter(config: AggregateConfig): Promise<void> {
  const { name } = config;
  const camelName = toCamelCase(name);
  const filePath = join(SRC_ROOT, "infrastructure", "routers", "adminCommandsRouter.ts");

  const file = Bun.file(filePath);
  let content = await file.text();

  // Add service import
  const serviceImport = `import { Create${name}Service } from "../../app/${camelName}/create${name}Service";`;
  const lastServiceImportMatch = content.match(/import.*Service.*from.*\n/g);
  if (lastServiceImportMatch) {
    const lastImport = lastServiceImportMatch[lastServiceImportMatch.length - 1];
    if (lastImport === undefined) {
      throw new Error("Last service import is undefined");
    }
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
    if (lastImport === undefined) {
      throw new Error("Last command import is undefined");
    }
    const lastImportIndex = content.lastIndexOf(lastImport);
    content = content.slice(0, lastImportIndex + lastImport.length) + "\n" + commandImport + content.slice(lastImportIndex + lastImport.length);
  }

  // Add service instantiation before the return statement
  const serviceInstantiation = `  const create${name}Service = new Create${name}Service(
    unitOfWork,

  );`;

  const returnMatch = content.match(/\n  return async \(type: CommandType/);
  if (!returnMatch || returnMatch.index === undefined) {
    throw new Error("Could not find return statement in admin commands router");
  }

  content = content.slice(0, returnMatch.index) + "\n" + serviceInstantiation + "\n" + content.slice(returnMatch.index);

  // Add switch case before the default case
  const switchCase = `        case "create${name}": {
          const command = Create${name}Command.parse({ ...(payload as any) });
          await create${name}Service.execute(command);
          break;
        }`;

  const defaultCaseMatch = content.match(/\n        default:\n          throw new Error/);
  if (defaultCaseMatch && defaultCaseMatch.index !== undefined) {
    content = content.slice(0, defaultCaseMatch.index) + "\n" + switchCase + content.slice(defaultCaseMatch.index);
  }

  await Bun.write(filePath, content);
  console.log(`  ✅ Updated: ${filePath}`);
}
