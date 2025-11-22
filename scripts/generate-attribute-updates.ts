#!/usr/bin/env bun

import { promptForAttributeUpdates } from "./utils/attributePrompts";
import { updateDomainLayer } from "./generators/updateAttributeDomainGenerator";
import { updateApplicationLayer } from "./generators/updateAttributeApplicationGenerator";
import { updateInfrastructureLayer } from "./generators/updateAttributeInfrastructureGenerator";
import { updateProjectionLayer } from "./generators/updateAttributeProjectionGenerator";
import { updateViewLayer } from "./generators/updateAttributeViewGenerator";
import { updateTestLayer } from "./generators/updateAttributeTestGenerator";

async function main() {
  try {
    // Get configuration from user
    const config = await promptForAttributeUpdates();

    console.log("\n🔨 Updating aggregate attributes...\n");

    // Update all layers
    await updateDomainLayer(config);
    await updateApplicationLayer(config);
    await updateInfrastructureLayer(config);
    await updateProjectionLayer(config);
    await updateViewLayer(config);
    await updateTestLayer(config);

    console.log("\n✅ Attribute updates complete!\n");
    console.log("📝 Next steps:");
    console.log(`  1. Review all changes carefully`);
    console.log(`  2. Run tests: bun test tests/domain/${config.aggregateCamelName}/`);
    console.log(`  3. Check that projections are updating correctly`);
    console.log(`  4. Update any custom business logic that references changed attributes`);
    console.log(`  5. Consider adding migrations if you're deploying to production\n`);

    console.log("⚠️  Important notes:");
    console.log(`  - Database schema was updated (breaking change)`);
    console.log(`  - Event schemas were updated`);
    console.log(`  - Test fixtures were automatically updated - verify they're still valid`);
    console.log(`  - Custom projection logic may need manual review\n`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\n❌ Error: ${error.message}`);
      console.error(error.stack);
    } else {
      console.error(`\n❌ Unknown error occurred`);
    }
    process.exit(1);
  }
}

main();
