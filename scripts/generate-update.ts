#!/usr/bin/env bun

import { promptForUpdateConfig } from "./utils/updatePrompts";
import { generateUpdateDomainLayer } from "./generators/updateDomainGenerator";
import { generateUpdateApplicationLayer } from "./generators/updateApplicationGenerator";
import { updateInfrastructureForUpdate } from "./generators/updateInfrastructureGenerator";
import { generateUpdateProjectionLayer } from "./generators/updateProjectionGenerator";
import { generateUpdateTests } from "./generators/updateTestGenerator";

async function main() {
  try {
    // Get configuration from user
    const config = await promptForUpdateConfig();

    console.log("\n🔨 Generating update method...\n");

    // Generate all layers
    await generateUpdateDomainLayer(config);
    await generateUpdateApplicationLayer(config);
    await updateInfrastructureForUpdate(config);
    await generateUpdateProjectionLayer(config);
    await generateUpdateTests(config);

    console.log("\n✅ Update method generation complete!\n");
    console.log("📝 Next steps:");
    console.log(`  1. Review the generated/modified files`);
    console.log(`  2. Run tests: bun test tests/domain/${config.aggregateCamelName}/${config.methodName}.test.ts`);
    console.log(`  3. Verify the projection logic is correct for your use case`);
    console.log(`  4. Test the command via the API endpoint\n`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\n❌ Error: ${error.message}`);
    } else {
      console.error(`\n❌ Unknown error occurred`);
    }
    process.exit(1);
  }
}

main();
