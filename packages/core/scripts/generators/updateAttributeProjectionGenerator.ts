import type { AttributeUpdateConfig, AttributeOperation } from "../utils/attributePrompts";
import { toSnakeCase, getDefaultValueForType } from "../utils/attributeTemplates";
import { Glob } from "bun";

export async function updateProjectionLayer(config: AttributeUpdateConfig): Promise<void> {
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

async function updateProjectionFile(filePath: string, config: AttributeUpdateConfig): Promise<void> {
  const file = Bun.file(filePath);
  let content = await file.text();

  // Find the create*ViewData function(s)
  const createFunctionRegex = new RegExp(
    `function create${config.aggregateName}[\\w]*ViewData\\([\\s\\S]*?\\): ${config.aggregateName}[\\w]*ViewData \\{[\\s\\S]*?return \\{[\\s\\S]*?\\}[\\s\\S]*?\\}`,
    "gm"
  );

  const functionMatches = content.match(createFunctionRegex);
  if (!functionMatches || functionMatches.length === 0) {
    console.log(`  ⚠️  No create*ViewData functions found in ${filePath}`);
    return;
  }

  // Update each function
  for (const functionMatch of functionMatches) {
    let updatedFunction = functionMatch;

    // Find the return object
    const returnObjRegex = /return \{[\s\S]*?\}/;
    const returnMatch = updatedFunction.match(returnObjRegex);

    if (returnMatch) {
      let returnObj = returnMatch[0];

      // Process each operation
      for (const op of config.operations) {
        if (op.type === "add") {
          returnObj = addFieldToReturnObject(returnObj, op, config);
        } else if (op.type === "rename") {
          returnObj = renameFieldInReturnObject(returnObj, op, config);
        } else if (op.type === "changeType") {
          // Type changes don't need special handling in projections
          // The mapping logic stays the same
        } else if (op.type === "delete") {
          returnObj = deleteFieldFromReturnObject(returnObj, op, config);
        }
      }

      updatedFunction = updatedFunction.replace(returnMatch[0], returnObj);
    }

    content = content.replace(functionMatch, updatedFunction);
  }

  // Also update createFromSnapshot functions if they exist
  const snapshotFunctionRegex = new RegExp(
    `function create${config.aggregateName}[\\w]*ViewDataFromSnapshot\\([\\s\\S]*?\\): ${config.aggregateName}[\\w]*ViewData \\{[\\s\\S]*?return \\{[\\s\\S]*?\\}[\\s\\S]*?\\}`,
    "gm"
  );

  const snapshotMatches = content.match(snapshotFunctionRegex);
  if (snapshotMatches) {
    for (const snapshotMatch of snapshotMatches) {
      let updatedFunction = snapshotMatch;

      const returnObjRegex = /return \{[\s\S]*?\}/;
      const returnMatch = updatedFunction.match(returnObjRegex);

      if (returnMatch) {
        let returnObj = returnMatch[0];

        for (const op of config.operations) {
          if (op.type === "add") {
            returnObj = addFieldToReturnObject(returnObj, op, config, true);
          } else if (op.type === "rename") {
            returnObj = renameFieldInReturnObject(returnObj, op, config, true);
          } else if (op.type === "delete") {
            returnObj = deleteFieldFromReturnObject(returnObj, op, config, true);
          }
        }

        updatedFunction = updatedFunction.replace(returnMatch[0], returnObj);
      }

      content = content.replace(snapshotMatch, updatedFunction);
    }
  }

  await Bun.write(filePath, content);
  console.log(`  ✅ Updated projection: ${filePath.split("/").pop()}`);
}

function addFieldToReturnObject(
  returnObj: string,
  op: Extract<AttributeOperation, { type: "add" }>,
  config: AttributeUpdateConfig,
  isSnapshot: boolean = false
): string {
  const dbColumnName = toSnakeCase(op.name);
  const defaultValue = getDefaultValueForType(op.fieldType);

  // Determine the source (state vs snapshotData)
  const source = isSnapshot ? "snapshotData" : "state";

  // Create the mapping line
  let mappingValue = `${source}.${op.name}`;

  // Handle type conversions
  if (op.fieldType === "boolean") {
    mappingValue = `${source}.${op.name} ? 1 : 0`;
  }

  // Handle optional fields with default
  if (op.optional) {
    mappingValue = `${source}.${op.name} ?? ${defaultValue}`;
  }

  const fieldLine = `    ${dbColumnName}: ${mappingValue},`;

  // Add before the closing }
  const closingIndex = returnObj.lastIndexOf("}");
  return (
    returnObj.substring(0, closingIndex) +
    `\n${fieldLine}\n  ` +
    returnObj.substring(closingIndex)
  );
}

function renameFieldInReturnObject(
  returnObj: string,
  op: Extract<AttributeOperation, { type: "rename" }>,
  config: AttributeUpdateConfig,
  isSnapshot: boolean = false
): string {
  const oldDbColumnName = toSnakeCase(op.oldName);
  const newDbColumnName = toSnakeCase(op.newName);

  // Update the DB column name
  const columnRegex = new RegExp(`(\\s+)${oldDbColumnName}:`, "g");
  returnObj = returnObj.replace(columnRegex, `$1${newDbColumnName}:`);

  // Update the source field reference
  const source = isSnapshot ? "snapshotData" : "state";
  const sourceRegex = new RegExp(`${source}\\.${op.oldName}\\b`, "g");
  returnObj = returnObj.replace(sourceRegex, `${source}.${op.newName}`);

  return returnObj;
}

function deleteFieldFromReturnObject(
  returnObj: string,
  op: Extract<AttributeOperation, { type: "delete" }>,
  config: AttributeUpdateConfig,
  isSnapshot: boolean = false
): string {
  const dbColumnName = toSnakeCase(op.name);

  // Remove the field line
  const fieldRegex = new RegExp(
    `\\s+${dbColumnName}:\\s*[^,]+,?\\n?`,
    "g"
  );

  return returnObj.replace(fieldRegex, "");
}
