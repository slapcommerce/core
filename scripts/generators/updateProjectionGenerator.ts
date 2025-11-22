import type { UpdateMethodConfig } from "../utils/updatePrompts";
import { generateEventName } from "../utils/updateTemplates";
import { Glob } from "bun";

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
  const projectionsPath = "/Users/ryanwible/projects/core/src/projections";
  const pattern = `**/*${aggregateCamelName}*Projection.ts`;

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
  content = addCaseStatement(content, config);

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
    return content.slice(0, defaultCaseIndex) + caseStatement + content.slice(defaultCaseIndex);
  }

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
