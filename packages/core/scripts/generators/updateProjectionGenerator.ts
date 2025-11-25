import type { UpdateMethodConfig } from "../utils/updatePrompts";
import { generateEventName } from "../utils/updateTemplates";
import { Glob } from "bun";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CORE_ROOT = join(__dirname, "../..");
const SRC_ROOT = join(CORE_ROOT, "src", "api");

export async function generateUpdateProjectionLayer(config: UpdateMethodConfig): Promise<void> {
  console.log("\n📊 Updating projection layer...");

  const projectionFiles = await findProjectionFiles(config.aggregateCamelName);

  if (projectionFiles.length === 0) {
    console.log(`  ⚠️  No projection files found for ${config.aggregateName}, skipping`);
    return;
  }

  for (const projectionFile of projectionFiles) {
    await updateProjectionFile(projectionFile, config);
  }
}

async function findProjectionFiles(aggregateCamelName: string): Promise<string[]> {
  const projectionsPath = join(SRC_ROOT, "projections");
  const pattern = `**/*${aggregateCamelName}*Projector.ts`;

  const glob = new Glob(pattern);
  const files: string[] = [];

  for await (const file of glob.scan({ cwd: projectionsPath })) {
    files.push(`${projectionsPath}/${file}`);
  }

  return files;
}

async function updateProjectionFile(filePath: string, config: UpdateMethodConfig): Promise<void> {
  const { eventName, aggregateName } = config;

  const file = Bun.file(filePath);
  let content = await file.text();

  const snakeCaseEventName = generateEventName(aggregateName, config.methodName);
  if (content.includes(`case "${snakeCaseEventName}":`)) {
    console.log(`  ⚠️  Event handler already exists, skipping`);
    return;
  }

  content = addEventImport(content, eventName, config.aggregateCamelName);
  content = ensureTypeImports(content, config.aggregateName, config.aggregateCamelName);
  content = ensureViewDataImport(content, config.aggregateName, config.aggregateCamelName);
  content = addCaseStatement(content, config);

  // Comprehensive import validation after all modifications
  content = validateAndFixAllImports(content);

  await Bun.write(filePath, content);
  console.log(`  ✅ Added event handler for ${snakeCaseEventName}`);
}

function addEventImport(content: string, eventName: string, aggregateCamelName: string): string {
  if (content.includes(eventName)) {
    return content;
  }

  const importRegex = new RegExp(
    `import\\s+{([^}]+)}\\s+from\\s+["'].*\\/domain\\/${aggregateCamelName}\\/events["']`,
    "s"
  );

  const match = content.match(importRegex);
  if (!match) {
    const firstEventImportMatch = content.match(/import\s+.*from\s+["'].*\/domain\/\w+\/events["']/);

    if (firstEventImportMatch && firstEventImportMatch.index !== undefined) {
      const insertIndex = firstEventImportMatch.index;
      const insertion = `import { ${eventName} } from "../../domain/${aggregateCamelName}/events"\n`;
      return content.slice(0, insertIndex) + insertion + content.slice(insertIndex);
    }

    const typeImportEnd = content.indexOf('\n', content.indexOf('import type'));
    if (typeImportEnd !== -1) {
      const insertion = `\nimport { ${eventName} } from "../../domain/${aggregateCamelName}/events"`;
      return content.slice(0, typeImportEnd + 1) + insertion + content.slice(typeImportEnd + 1);
    }

    return content;
  }

  const imports = match[1];
  if (imports === undefined) {
    throw new Error("Event import content is undefined");
  }
  const trimmedImports = imports.trimEnd();
  // Check if there's already a trailing comma
  const hasTrailingComma = trimmedImports.endsWith(',');
  const updatedImports = hasTrailingComma
    ? trimmedImports + "\n  " + eventName
    : trimmedImports + ",\n  " + eventName;
  return content.replace(importRegex, `import {${updatedImports}\n} from "../../domain/${aggregateCamelName}/events"`);
}

function ensureTypeImports(content: string, aggregateName: string, aggregateCamelName: string): string {
  const eventTypeName = `${aggregateName}Event`;
  const stateTypeName = `${aggregateName}State`;

  // Check if type imports already exist
  const hasEventType = new RegExp(`import\\s+type\\s+{[^}]*${eventTypeName}[^}]*}\\s+from\\s+["'].*\\/domain\\/${aggregateCamelName}\\/events["']`).test(content);
  const hasStateType = new RegExp(`import\\s+type\\s+{[^}]*${stateTypeName}[^}]*}\\s+from\\s+["'].*\\/domain\\/${aggregateCamelName}\\/events["']`).test(content);

  let result = content;

  // Find where to insert type imports (after the last event import from this aggregate)
  const lastEventImportRegex = new RegExp(`import\\s+{[^}]+}\\s+from\\s+["'].*\\/domain\\/${aggregateCamelName}\\/events["'];?`, 'g');
  const matches = [...content.matchAll(lastEventImportRegex)];

  if (matches.length > 0) {
    const lastMatch = matches[matches.length - 1];
    if (lastMatch === undefined) {
      throw new Error("Last event import is undefined");
    }
    const insertIndex = (lastMatch.index || 0) + lastMatch[0].length;

    const importsToAdd: string[] = [];
    if (!hasEventType) {
      importsToAdd.push(`import type { ${eventTypeName} } from "../../domain/${aggregateCamelName}/events";`);
    }
    if (!hasStateType) {
      importsToAdd.push(`import type { ${stateTypeName} } from "../../domain/${aggregateCamelName}/events";`);
    }

    if (importsToAdd.length > 0) {
      const insertion = '\n' + importsToAdd.join('\n');
      result = result.slice(0, insertIndex) + insertion + result.slice(insertIndex);
    }
  }

  return result;
}

function ensureViewDataImport(content: string, aggregateName: string, aggregateCamelName: string): string {
  const readModelTypeName = `${aggregateName}ReadModel`;

  // Check if ReadModel type is used in the file
  if (!content.includes(readModelTypeName)) {
    return content;
  }

  // Check if import already exists
  const hasReadModelImport = new RegExp(`import\\s+type\\s+{[^}]*${readModelTypeName}[^}]*}\\s+from\\s+["'].*\\/infrastructure\\/repositories\\/${aggregateCamelName}ReadModelRepository["']`).test(content);

  if (hasReadModelImport) {
    return content;
  }

  // Add the import after the UnitOfWorkRepositories import
  const unitOfWorkImportRegex = /import\s+type\s+{\s*UnitOfWorkRepositories[^}]*}\s+from\s+["'][^"']*infrastructure\/unitOfWork["'];?/;
  const match = content.match(unitOfWorkImportRegex);

  if (match && match.index !== undefined) {
    const insertIndex = match.index + match[0].length;
    const insertion = `\nimport type { ${readModelTypeName} } from "../../infrastructure/repositories/${aggregateCamelName}ReadModelRepository";`;
    return content.slice(0, insertIndex) + insertion + content.slice(insertIndex);
  }

  // Fallback: add after the first type import
  const firstTypeImportMatch = content.match(/import\s+type\s+.*from\s+["'][^"']+["'];?/);
  if (firstTypeImportMatch && firstTypeImportMatch.index !== undefined) {
    const insertIndex = firstTypeImportMatch.index + firstTypeImportMatch[0].length;
    const insertion = `\nimport type { ${readModelTypeName} } from "../../infrastructure/repositories/${aggregateCamelName}ReadModelRepository";`;
    return content.slice(0, insertIndex) + insertion + content.slice(insertIndex);
  }

  return content;
}

function validateAndFixAllImports(content: string): string {
  // Extract all event types used in the file (from "as EventType" casts)
  const eventTypePattern = /event as (\w+Event)/g;
  const usedEventTypes = new Set<string>();
  let match;
  while ((match = eventTypePattern.exec(content)) !== null) {
    if (match[1]) usedEventTypes.add(match[1]);
  }

  // Extract aggregate types used (from ".loadFromSnapshot" calls)
  const aggregatePattern = /(\w+Aggregate)\.loadFromSnapshot/g;
  const usedAggregates = new Set<string>();
  while ((match = aggregatePattern.exec(content)) !== null) {
    if (match[1]) usedAggregates.add(match[1]);
  }

  // Extract all event type unions (from function parameters like "event: ProductEvent | CollectionEvent")
  const eventUnionPattern = /event:\s*([^)]+)/g;
  const usedEventUnionTypes = new Set<string>();
  while ((match = eventUnionPattern.exec(content)) !== null) {
    if (match[1]) {
      // Extract individual types from union (e.g., "ProductEvent | CollectionEvent")
      const types = match[1].split('|').map(t => t.trim());
      for (const type of types) {
        if (type.endsWith('Event') && !type.includes(' ')) {
          usedEventUnionTypes.add(type);
        }
      }
    }
  }

  // Determine which aggregate each event belongs to
  const eventToAggregate = new Map<string, string>();
  for (const eventType of usedEventTypes) {
    // Extract aggregate name from event type (e.g., "ProductCreatedEvent" -> "product")
    const aggregateMatch = eventType.match(/^(\w+?)(?:Created|Archived|Published|Unpublished|Slug|Details|Metadata|Classification|Tags|Collections|Variant|Fulfillment|Update|Price|Inventory|Sku|Images|Digital|Seo)/);
    if (aggregateMatch && aggregateMatch[1]) {
      const aggregateName = aggregateMatch[1].toLowerCase();
      eventToAggregate.set(eventType, aggregateName);
    }
  }

  // Similarly for union types
  for (const eventType of usedEventUnionTypes) {
    const aggregateMatch = eventType.match(/^(\w+)Event$/);
    if (aggregateMatch && aggregateMatch[1]) {
      const aggregateName = aggregateMatch[1].toLowerCase();
      eventToAggregate.set(eventType, aggregateName);
    }
  }

  // Group events by aggregate
  const eventsByAggregate = new Map<string, Set<string>>();
  for (const [eventType, aggregate] of eventToAggregate.entries()) {
    if (!eventsByAggregate.has(aggregate)) {
      eventsByAggregate.set(aggregate, new Set());
    }
    eventsByAggregate.get(aggregate)!.add(eventType);
  }

  // Check which imports already exist and which are missing
  let result = content;

  // Ensure event imports for each aggregate
  for (const [aggregate, events] of eventsByAggregate.entries()) {
    const missingEvents = new Set(events);

    // Check which events are already imported
    const importRegex = new RegExp(
      `import\\s+(?:type\\s+)?{([^}]+)}\\s+from\\s+["'].*\\/domain\\/${aggregate}\\/events["']`,
      'gs'
    );

    let importMatch;
    while ((importMatch = importRegex.exec(result)) !== null) {
      if (importMatch[1]) {
        const importedTypes = importMatch[1].split(',').map(t => t.trim());
        for (const importedType of importedTypes) {
          missingEvents.delete(importedType);
        }
      }
    }

    // Add missing event imports
    if (missingEvents.size > 0) {
      result = addMissingEventImports(result, aggregate, Array.from(missingEvents));
    }
  }

  // Ensure aggregate class imports
  for (const aggregateType of usedAggregates) {
    if (!result.includes(`import { ${aggregateType} }`)) {
      const aggregate = aggregateType.replace('Aggregate', '').toLowerCase();
      result = addAggregateImport(result, aggregateType, aggregate);
    }
  }

  // Ensure ProductsReadModel import if used
  if (result.includes('ProductsReadModel') && !result.includes('import type { ProductsReadModel }')) {
    result = addReadModelTypeImport(result);
  }

  return result;
}

function addMissingEventImports(content: string, aggregate: string, eventTypes: string[]): string {
  // Try to find existing import for this aggregate
  const importRegex = new RegExp(
    `(import\\s+{)([^}]+)(}\\s+from\\s+["'].*\\/domain\\/${aggregate}\\/events["'])`,
    's'
  );

  const match = content.match(importRegex);
  if (match) {
    // Add to existing import
    const existingImports = match[2]?.trim() || '';
    const newImports = eventTypes.join(',\n  ');
    const updatedImports = existingImports
      ? `${existingImports.trimEnd()},\n  ${newImports}\n`
      : `\n  ${newImports}\n`;
    return content.replace(importRegex, `$1${updatedImports}$3`);
  } else {
    // Create new import statement
    const newImport = `import {\n  ${eventTypes.join(',\n  ')}\n} from "../../domain/${aggregate}/events"\n`;

    // Insert after the first import statement
    const firstImportMatch = content.match(/import\s+.*from\s+["'][^"']+["'];?\n/);
    if (firstImportMatch && firstImportMatch.index !== undefined) {
      const insertIndex = firstImportMatch.index + firstImportMatch[0].length;
      return content.slice(0, insertIndex) + newImport + content.slice(insertIndex);
    }
  }

  return content;
}

function addAggregateImport(content: string, aggregateType: string, aggregate: string): string {
  const newImport = `import { ${aggregateType} } from "../../domain/${aggregate}/aggregate";\n`;

  // Insert after the last domain import
  const domainImportRegex = /import\s+.*from\s+["'].*\/domain\/[^"']+["'];?\n/g;
  const matches = [...content.matchAll(domainImportRegex)];

  if (matches.length > 0) {
    const lastMatch = matches[matches.length - 1];
    if (lastMatch && lastMatch.index !== undefined) {
      const insertIndex = lastMatch.index + lastMatch[0].length;
      return content.slice(0, insertIndex) + newImport + content.slice(insertIndex);
    }
  }

  return content;
}

function addReadModelTypeImport(content: string): string {
  const newImport = `import type { ProductsReadModel } from "../../infrastructure/repositories/ProductsReadModelRepository"\n`;

  // Insert after UnitOfWorkRepositories import
  const unitOfWorkMatch = content.match(/import\s+type\s+{\s*UnitOfWorkRepositories[^}]*}\s+from\s+["'][^"']*unitOfWork["'];?\n/);
  if (unitOfWorkMatch && unitOfWorkMatch.index !== undefined) {
    const insertIndex = unitOfWorkMatch.index + unitOfWorkMatch[0].length;
    return content.slice(0, insertIndex) + newImport + content.slice(insertIndex);
  }

  return content;
}

function addCaseStatement(content: string, config: UpdateMethodConfig): string {
  const { aggregateName, eventName, methodName } = config;
  const snakeCaseEventName = generateEventName(aggregateName, methodName);
  const eventVarName = eventName.charAt(0).toLowerCase() + eventName.slice(1);

  const caseStatement = `      case "${snakeCaseEventName}": {
        const ${eventVarName} = event as ${eventName};
        const state = ${eventVarName}.payload.newState;

        // TODO: Implement projection logic
        break;
      }
`;

  const switchMatch = content.match(/switch\s*\(event\.eventName\)\s*{/);
  if (!switchMatch || switchMatch.index === undefined) {
    console.log("  ⚠️  Could not find switch statement");
    return content;
  }

  const defaultCaseIndex = content.indexOf("default:", switchMatch.index);

  if (defaultCaseIndex !== -1) {
    // Find the start of the line containing 'default:' to remove any leading whitespace
    let lineStart = defaultCaseIndex;
    while (lineStart > 0 && content[lineStart - 1] !== '\n') {
      lineStart--;
    }
    // Insert before the line start (removes any existing indentation)
    return content.slice(0, lineStart) + caseStatement + content.slice(lineStart);
  }

  // Find the last case statement (improved regex for multi-line cases)
  const lastCaseRegex = /case\s+"[^"]+"\s*:\s*{[\s\S]*?break;\s*}/g;
  let lastMatch;
  let lastCaseEnd = -1;

  while ((lastMatch = lastCaseRegex.exec(content)) !== null) {
    if (lastMatch.index > switchMatch.index) {
      lastCaseEnd = lastMatch.index + lastMatch[0].length;
    }
  }

  if (lastCaseEnd !== -1) {
    return content.slice(0, lastCaseEnd) + "\n" + caseStatement + content.slice(lastCaseEnd);
  }

  console.log("  ⚠️  Could not find insertion point");
  return content;
}
