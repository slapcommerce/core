import type { UpdateMethodConfig } from "../utils/updatePrompts";
import { generateEventClass, generateAggregateMethod, generateEventName } from "../utils/updateTemplates";

export async function generateUpdateDomainLayer(config: UpdateMethodConfig): Promise<void> {
  console.log("\n🏗️  Generating domain layer...");

  await addEventToEventsFile(config);
  await addMethodToAggregate(config);
  await addEventToEventTypeUnion(config);
}

async function addEventToEventsFile(config: UpdateMethodConfig): Promise<void> {
  const { aggregateCamelName, eventName } = config;
  const eventsPath = `/Users/ryanwible/projects/core/src/domain/${aggregateCamelName}/events.ts`;

  const file = Bun.file(eventsPath);
  const content = await file.text();

  // Check if event already exists
  if (content.includes(`export class ${eventName}`)) {
    console.log(`  ⚠️  Event ${eventName} already exists, skipping`);
    return;
  }

  // Generate the event class
  const eventClass = generateEventClass(config);

  // Find where to insert - before the last export (usually the union type)
  // Look for the last occurrence of "export type"
  const lastExportMatch = content.match(/export type \w+Event =[\s\S]*?;/g);

  if (lastExportMatch) {
    const lastExport = lastExportMatch[lastExportMatch.length - 1];
    const insertIndex = content.lastIndexOf(lastExport);

    // Insert before the union type
    const newContent = content.slice(0, insertIndex) + eventClass + "\n\n" + content.slice(insertIndex);

    // Also need to add to the union type
    const updatedContent = addToEventUnion(newContent, config);

    // Add to imports at the top if there's a DomainEvent import
    await Bun.write(eventsPath, updatedContent);
    console.log(`  ✅ Added ${eventName} to events.ts`);
  } else {
    // No union type found, just append
    await Bun.write(eventsPath, content + "\n\n" + eventClass);
    console.log(`  ✅ Added ${eventName} to events.ts`);
  }
}

function addToEventUnion(content: string, config: UpdateMethodConfig): string {
  const { aggregateName, eventName } = config;
  const unionTypeName = `${aggregateName}Event`;

  // Find the union type (space after = is optional)
  const unionRegex = new RegExp(
    `export type ${unionTypeName}\\s*= ?([\\s\\S]*?);`,
    "m"
  );

  const match = content.match(unionRegex);
  if (!match) {
    return content; // Union type not found, return as-is
  }

  const unionContent = match[1];

  // Check if already in union
  if (unionContent.includes(eventName)) {
    return content;
  }

  // Add to union - find the last type and add after it
  // Remove the trailing semicolon if present, then add new type
  const trimmed = unionContent.trimEnd();
  const lastSemicolonMatch = trimmed.match(/;$/);
  const withoutSemicolon = lastSemicolonMatch ? trimmed.slice(0, -1) : trimmed;

  const updatedUnion = withoutSemicolon + "\n  | " + eventName;
  return content.replace(unionRegex, `export type ${unionTypeName} = ${updatedUnion};`);
}

async function addMethodToAggregate(config: UpdateMethodConfig): Promise<void> {
  const { aggregateCamelName, methodName, eventName } = config;
  const aggregatePath = `/Users/ryanwible/projects/core/src/domain/${aggregateCamelName}/aggregate.ts`;

  const file = Bun.file(aggregatePath);
  const content = await file.text();

  // Check if method already exists
  if (content.includes(`${methodName}(`)) {
    console.log(`  ⚠️  Method ${methodName} already exists, skipping`);
    return;
  }

  // Generate the method
  const method = generateAggregateMethod(config);

  // Find where to insert - before the last closing brace of the class
  const lastBraceIndex = content.lastIndexOf("}");
  if (lastBraceIndex === -1) {
    throw new Error("Could not find class closing brace in aggregate file");
  }

  // Insert the method before the last brace
  const newContent = content.slice(0, lastBraceIndex) + "\n" + method + "\n}\n";

  // Add import for the event at the top
  const updatedContent = addEventImport(newContent, eventName);

  await Bun.write(aggregatePath, updatedContent);
  console.log(`  ✅ Added ${methodName} method to aggregate`);
}

function addEventImport(content: string, eventName: string): string {
  // Find the import statement from "./events"
  const importRegex = /import\s+{([^}]+)}\s+from\s+["']\.\/events["'];/;
  const match = content.match(importRegex);

  if (!match) {
    // No events import found, add it
    const firstImport = content.match(/^import\s+/m);
    if (firstImport) {
      return content.replace(firstImport[0], `import { ${eventName} } from "./events";\n${firstImport[0]}`);
    }
    return `import { ${eventName} } from "./events";\n\n` + content;
  }

  // Check if already imported
  if (match[1].includes(eventName)) {
    return content;
  }

  // Add to existing imports
  const imports = match[1].trim();
  // Check if imports already has a trailing comma
  const needsComma = !imports.endsWith(",");
  const updatedImports = imports + (needsComma ? ",\n  " : "\n  ") + eventName;

  return content.replace(importRegex, `import {${updatedImports}} from "./events";`);
}

async function addEventToEventTypeUnion(config: UpdateMethodConfig): Promise<void> {
  const { aggregateName, methodName } = config;
  const domainEventPath = "/Users/ryanwible/projects/core/src/domain/_base/domainEvent.ts";

  const file = Bun.file(domainEventPath);
  let content = await file.text();

  // Generate the snake_case event name (e.g., "product.details_updated")
  const snakeCaseEventName = generateEventName(aggregateName, methodName);

  // Check if already in EventType union
  if (content.includes(`"${snakeCaseEventName}"`)) {
    console.log(`  ⚠️  Event type "${snakeCaseEventName}" already in EventType union, skipping`);
    return;
  }

  // Find the EventType union
  const eventTypeRegex = /export type EventType\s*=([\s\S]*?);/;
  const match = content.match(eventTypeRegex);

  if (!match) {
    console.log("  ⚠️  Could not find EventType union in domainEvent.ts");
    return;
  }

  const unionContent = match[1];

  // Find the section for this aggregate (e.g., "// Product events")
  const aggregateCommentRegex = new RegExp(`// ${aggregateName} events`, "i");
  const aggregateSectionMatch = unionContent.match(aggregateCommentRegex);

  if (!aggregateSectionMatch) {
    console.log(`  ⚠️  Could not find "${aggregateName} events" section in EventType union`);
    console.log(`  ℹ️  You may need to manually add: | "${snakeCaseEventName}"`);
    return;
  }

  // Find where this aggregate's events end (next comment or end of union)
  const aggregateSectionIndex = unionContent.indexOf(aggregateSectionMatch[0]);
  const nextCommentMatch = unionContent.slice(aggregateSectionIndex + aggregateSectionMatch[0].length).match(/\n\s*\/\//);

  let insertionPoint: number;
  if (nextCommentMatch && nextCommentMatch.index !== undefined) {
    // Insert before the next comment section
    insertionPoint = aggregateSectionIndex + aggregateSectionMatch[0].length + nextCommentMatch.index;
  } else {
    // No next section, insert at the end (before the closing of union)
    insertionPoint = unionContent.length;
  }

  // Build the new event line with proper indentation (2 spaces before pipe)
  const newEventLine = `  | "${snakeCaseEventName}"`;

  // Insert the new event
  const beforeInsertion = unionContent.slice(0, insertionPoint);
  const afterInsertion = unionContent.slice(insertionPoint);
  const updatedUnion = beforeInsertion + "\n" + newEventLine + afterInsertion;

  // Replace in content
  const newContent = content.replace(eventTypeRegex, `export type EventType =${updatedUnion};`);

  await Bun.write(domainEventPath, newContent);
  console.log(`  ✅ Added "${snakeCaseEventName}" to EventType union`);
}
