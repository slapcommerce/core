import type { UpdateMethodConfig } from "../utils/updatePrompts";
import { toCamelCase } from "../utils/templates";

export async function updateInfrastructureForUpdate(config: UpdateMethodConfig): Promise<void> {
  console.log("\n🔌 Updating infrastructure layer...");

  const { accessLevel } = config;

  if (accessLevel === "admin") {
    await updateAdminCommandsRouter(config);
  } else {
    await updatePublicCommandsRouter(config);
  }
}

async function updateAdminCommandsRouter(config: UpdateMethodConfig): Promise<void> {
  const routerPath = "/Users/ryanwible/projects/core/src/infrastructure/routers/adminCommandsRouter.ts";
  await updateRouter(routerPath, config);
}

async function updatePublicCommandsRouter(config: UpdateMethodConfig): Promise<void> {
  const routerPath = "/Users/ryanwible/projects/core/src/infrastructure/routers/publicCommandsRouter.ts";
  await updateRouter(routerPath, config);
}

async function updateRouter(routerPath: string, config: UpdateMethodConfig): Promise<void> {
  const {
    aggregateCamelName,
    commandName,
    commandType,
    methodName,
    aggregateName,
  } = config;

  const file = Bun.file(routerPath);
  let content = await file.text();

  const serviceName = commandName.replace("Command", "Service");
  const serviceFileName = `${methodName}${aggregateName}Service`;

  // Check if already wired up
  if (content.includes(serviceName)) {
    console.log(`  ⚠️  ${serviceName} already wired up in router, skipping`);
    return;
  }

  // 1. Add service import at the top
  content = addServiceImport(content, serviceName, aggregateCamelName, serviceFileName);

  // 2. Add command import to the existing import block
  content = addCommandImport(content, commandName, aggregateCamelName);

  // 3. Add service instantiation
  content = addServiceInstantiation(content, serviceName, toCamelCase(serviceName));

  // 4. Add switch case
  content = addSwitchCase(content, commandType, commandName, toCamelCase(serviceName));

  await Bun.write(routerPath, content);
  console.log(`  ✅ Wired up ${serviceName} in router`);
}

function addServiceImport(
  content: string,
  serviceName: string,
  aggregateCamelName: string,
  serviceFileName: string
): string {
  // Find where service imports are (usually at the top, before command imports)
  const serviceImportRegex = /import\s+{\s*(\w+Service)\s*}\s+from\s+["'].*\/app\/\w+\/\w+Service["'];/;

  const match = content.match(serviceImportRegex);
  if (!match) {
    // No service imports found, add after type imports
    const typeImportIndex = content.indexOf('import type');
    if (typeImportIndex !== -1) {
      const lineEnd = content.indexOf('\n', typeImportIndex);
      const insertion = `\nimport { ${serviceName} } from "../../app/${aggregateCamelName}/${serviceFileName}";`;
      return content.slice(0, lineEnd + 1) + insertion + content.slice(lineEnd + 1);
    }
  }

  // Find the last service import
  const allServiceImports = content.match(/import\s+{\s*\w+Service\s*}\s+from\s+["'].*\/app\/\w+\/\w+Service["'];/g);
  if (allServiceImports && allServiceImports.length > 0) {
    const lastImport = allServiceImports[allServiceImports.length - 1];
    if (lastImport === undefined) {
      throw new Error("Last service import is undefined");
    }
    const lastImportIndex = content.lastIndexOf(lastImport);
    const insertIndex = lastImportIndex + lastImport.length;

    const insertion = `\nimport { ${serviceName} } from "../../app/${aggregateCamelName}/${serviceFileName}";`;
    return content.slice(0, insertIndex) + insertion + content.slice(insertIndex);
  }

  // Fallback: add at the beginning
  return `import { ${serviceName} } from "../../app/${aggregateCamelName}/${serviceFileName}";\n` + content;
}

function addCommandImport(
  content: string,
  commandName: string,
  aggregateCamelName: string
): string {
  // Find the import block for this aggregate's commands
  // Match the full import statement across multiple lines
  const commandImportRegex = new RegExp(
    `(import\\s+{[^}]+}\\s+from\\s+["'].*\\/app\\/${aggregateCamelName}\\/commands["'];)`,
    "g"
  );

  const matches = content.match(commandImportRegex);
  if (!matches || matches.length === 0) {
    // No command import block found for this aggregate, create one
    // Find the last command import block
    const lastCommandImportMatch = content.match(/import\s+{[^}]+}\s+from\s+["'].*\/app\/\w+\/commands["'];/g);

    if (lastCommandImportMatch) {
      const lastImport = lastCommandImportMatch[lastCommandImportMatch.length - 1];
      if (lastImport === undefined) {
        throw new Error("Last command import is undefined");
      }
      const lastImportIndex = content.lastIndexOf(lastImport);
      const insertIndex = lastImportIndex + lastImport.length;

      const insertion = `\nimport {\n  ${commandName},\n} from "../../app/${aggregateCamelName}/commands";`;
      return content.slice(0, insertIndex) + insertion + content.slice(insertIndex);
    }

    return content;
  }

  // Found existing import block for this aggregate
  const importStatement = matches[0];

  // Check if already imported
  if (importStatement.includes(commandName)) {
    console.log(`  ⚠️  ${commandName} already imported, skipping`);
    return content;
  }

  // Extract the commands list
  const importMatch = importStatement.match(/import\s+{([^}]+)}/);
  if (!importMatch) {
    return content;
  }

  const imports = importMatch[1];
  if (imports === undefined) {
    throw new Error("Command import content is undefined");
  }

  // Add new command to the list (handle trailing comma properly)
  const trimmedImports = imports.trimEnd();
  const hasTrailingComma = trimmedImports.endsWith(',');

  const updatedImports = hasTrailingComma
    ? trimmedImports + "\n  " + commandName + ","
    : trimmedImports + ",\n  " + commandName + ",";

  const updatedImportStatement = importStatement.replace(
    /import\s+{[^}]+}/,
    `import {${updatedImports}\n}`
  );

  return content.replace(importStatement, updatedImportStatement);
}

function addServiceInstantiation(
  content: string,
  serviceName: string,
  serviceVarName: string
): string {
  // Find where services are instantiated (after the function signature)
  // Look for pattern like: const createProductService = new CreateProductService(
  const instantiationRegex = /const\s+\w+Service\s+=\s+new\s+\w+Service\([^)]*\);/g;

  const matches = content.match(instantiationRegex);
  if (!matches || matches.length === 0) {
    return content;
  }

  // Find the last instantiation
  const lastInstantiation = matches[matches.length - 1];
  if (lastInstantiation === undefined) {
    throw new Error("Last service instantiation is undefined");
  }
  const lastIndex = content.lastIndexOf(lastInstantiation);
  const insertIndex = lastIndex + lastInstantiation.length;

  const insertion = `\n  const ${serviceVarName} = new ${serviceName}(\n    unitOfWork,\n  );`;
  return content.slice(0, insertIndex) + insertion + content.slice(insertIndex);
}

function addSwitchCase(
  content: string,
  commandType: string,
  commandName: string,
  serviceVarName: string
): string {
  // Find the switch statement and add a case
  // Look for the closing of the switch (default case or last case)
  const switchMatch = content.match(/switch\s*\(type\)\s*{/);
  if (!switchMatch || switchMatch.index === undefined) {
    console.log("  ⚠️  Could not find switch statement, please add case manually");
    return content;
  }

  // Find the default case or the last case before the switch closes
  const defaultCaseIndex = content.indexOf("default:", switchMatch.index);

  const caseStatement = `        case "${commandType}": {
          const command = ${commandName}.parse({ ...(payload as any)});
          await ${serviceVarName}.execute(command);
          break;
        }
`;

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
  const lastCaseMatch = content.match(/case\s+"[^"]+"\s*:\s*{[\s\S]*?break;\s*}/g);
  if (lastCaseMatch && lastCaseMatch.length > 0) {
    const lastCase = lastCaseMatch[lastCaseMatch.length - 1];
    if (lastCase === undefined) {
      throw new Error("Last switch case is undefined");
    }
    const lastCaseIndex = content.lastIndexOf(lastCase);
    const insertIndex = lastCaseIndex + lastCase.length;

    return content.slice(0, insertIndex) + "\n" + caseStatement + content.slice(insertIndex);
  }

  console.log("  ⚠️  Could not find insertion point for switch case, please add manually");
  return content;
}
