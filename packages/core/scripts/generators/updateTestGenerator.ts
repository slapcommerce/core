import type { UpdateMethodConfig } from "../utils/updatePrompts";
import { generateTestFile } from "../utils/updateTemplates";
import { writeFile } from "../utils/fileWriter";

export async function generateUpdateTests(config: UpdateMethodConfig): Promise<void> {
  console.log("\n🧪 Generating tests...");

  const { aggregateCamelName, methodName } = config;
  const testFilePath = `/Users/ryanwible/projects/core/tests/domain/${aggregateCamelName}/${methodName}.test.ts`;

  // Check if test file already exists
  if (await Bun.file(testFilePath).exists()) {
    console.log(`  ⚠️  Test file ${methodName}.test.ts already exists, skipping`);
    return;
  }

  // Generate test file
  const testContent = generateTestFile(config);

  await writeFile(testFilePath, testContent);
}
