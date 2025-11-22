#!/usr/bin/env bun

import { z } from "zod";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

// Import all command modules
import * as productCommands from "../src/app/product/commands";
import * as collectionCommands from "../src/app/collection/commands";
import * as variantCommands from "../src/app/variant/commands";
import * as scheduleCommands from "../src/app/schedule/commands";

// Import all query modules
import * as productQueries from "../src/views/product/queries";
import * as collectionQueries from "../src/views/collection/queries";
import * as variantQueries from "../src/views/variant/queries";
import * as scheduleQueries from "../src/views/schedule/queries";
import * as slugQueries from "../src/views/slug/queries";

interface CommandMetadata {
  name: string;        // "createProduct"
  typeName: string;    // "CreateProductCommand"
  schema: z.ZodTypeAny;
  domain: string;      // "product"
}

interface QueryMetadata {
  name: string;        // "productListView"
  typeName: string;    // "GetProductListQuery"
  schema: z.ZodTypeAny;
  domain: string;
  category: "admin" | "public";
}

function extractCommandName(typeName: string): string {
  // "CreateProductCommand" -> "createProduct"
  const withoutSuffix = typeName.replace(/Command$/, "");
  return withoutSuffix.charAt(0).toLowerCase() + withoutSuffix.slice(1);
}

// Manual mapping of query type names to router query names
const QUERY_NAME_MAP: Record<string, string> = {
  "GetProductListQuery": "productListView",
  "GetProductCollectionsQuery": "productCollectionsView",
  "GetProductVariantsQuery": "productVariantsView",
  "GetCollectionsQuery": "collectionsView",
  "GetVariantsQuery": "variantsView",
  "GetSchedulesQuery": "schedulesView",
  "GetSlugRedirectsQuery": "slugRedirectsView",
  "GetSlugRedirectChainQuery": "slugRedirectChain"
};

function extractQueryName(typeName: string): string {
  // Use manual mapping, or fallback to transformation
  if (QUERY_NAME_MAP[typeName]) {
    return QUERY_NAME_MAP[typeName];
  }

  // Fallback transformation
  const withoutPrefix = typeName.replace(/^Get/, "");
  const withoutSuffix = withoutPrefix.replace(/Query$/, "");
  return withoutSuffix.charAt(0).toLowerCase() + withoutSuffix.slice(1);
}

function collectCommands(): CommandMetadata[] {
  const commands: CommandMetadata[] = [];

  const domains = [
    { module: productCommands, name: "product" },
    { module: collectionCommands, name: "collection" },
    { module: variantCommands, name: "variant" },
    { module: scheduleCommands, name: "schedule" }
  ];

  for (const { module, name } of domains) {
    for (const [key, value] of Object.entries(module)) {
      // Check if it's a Zod schema (has _def property) and ends with Command
      if (key.endsWith("Command") && value && typeof value === "object" && "_def" in value) {
        commands.push({
          name: extractCommandName(key),
          typeName: key,
          schema: value as z.ZodTypeAny,
          domain: name
        });
      }
    }
  }

  return commands.sort((a, b) => a.name.localeCompare(b.name));
}

function collectQueries(): { admin: QueryMetadata[]; public: QueryMetadata[] } {
  const allQueries: QueryMetadata[] = [];

  const domains = [
    { module: productQueries, name: "product" },
    { module: collectionQueries, name: "collection" },
    { module: variantQueries, name: "variant" },
    { module: scheduleQueries, name: "schedule" },
    { module: slugQueries, name: "slug" }
  ];

  for (const { module, name } of domains) {
    for (const [key, value] of Object.entries(module)) {
      // Check if it's a Zod schema (has _def property) and ends with Query
      if (key.endsWith("Query") && value && typeof value === "object" && "_def" in value) {
        allQueries.push({
          name: extractQueryName(key),
          typeName: key,
          schema: value as z.ZodTypeAny,
          domain: name,
          category: "admin" // Will categorize below
        });
      }
    }
  }

  // Categorize queries based on routers
  // Admin queries: productListView, productCollectionsView, collectionsView, productVariantsView, slugRedirectsView, slugRedirectChain, schedulesView, variantsView
  const adminQueryNames = ["productListView", "productCollectionsView", "collectionsView", "productVariantsView", "slugRedirectsView", "slugRedirectChain", "schedulesView", "variantsView"];
  const publicQueryNames = ["productListView", "productCollectionsView", "productVariantsView", "slugRedirectsView"];

  const admin = allQueries
    .filter(q => adminQueryNames.includes(q.name))
    .map(q => ({ ...q, category: "admin" as const }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const publicQueries = allQueries
    .filter(q => publicQueryNames.includes(q.name))
    .map(q => ({ ...q, category: "public" as const }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { admin, public: publicQueries };
}

function zodToTypeScript(schema: z.ZodTypeAny, indent = 2): string {
  const spaces = " ".repeat(indent);
  const def = (schema as any)._def;
  const shape = (schema as any).shape;
  const constructor = (schema as any).constructor?.name;

  // Check for ZodObject by presence of shape
  if (shape && typeof shape === "object") {
    const fields: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const fieldType = zodToTypeScript(value as z.ZodTypeAny, indent + 2);
      fields.push(`${spaces}${key}: ${fieldType};`);
    }

    return `{\n${fields.join("\n")}\n${" ".repeat(indent - 2)}}`;
  }

  // Check for optional/nullable wrappers by constructor name first
  if (constructor === "ZodOptional" && def && "innerType" in def) {
    return zodToTypeScript(def.innerType, indent) + " | undefined";
  }

  if (constructor === "ZodNullable" && def && "innerType" in def) {
    return zodToTypeScript(def.innerType, indent) + " | null";
  }

  if (constructor === "ZodDefault" && def && "innerType" in def) {
    return zodToTypeScript(def.innerType, indent);
  }

  // Check for effects/refined by constructor
  if (constructor === "ZodEffects" && def && "schema" in def) {
    return zodToTypeScript(def.schema, indent);
  }

  // Check for array by constructor
  if (constructor === "ZodArray" && def && "element" in def) {
    const itemType = zodToTypeScript(def.element || def.type, indent);
    return `Array<${itemType}>`;
  }

  // Check for literal by constructor or presence of def.value
  if (constructor === "ZodLiteral" && def && "values" in def && Array.isArray(def.values) && def.values.length > 0) {
    const value = def.values[0];
    return typeof value === "string" ? `"${value}"` : String(value);
  }

  if (def && "value" in def) {
    const value = def.value;
    return typeof value === "string" ? `"${value}"` : String(value);
  }

  // Check for enum by presence of def.values
  if (constructor === "ZodEnum" && def && "values" in def && Array.isArray(def.values)) {
    const values = def.values as string[];
    return values.map(v => `"${v}"`).join(" | ");
  }

  // Check for union by constructor
  if (constructor === "ZodUnion" && def && "options" in def && Array.isArray(def.options)) {
    const options = def.options as z.ZodTypeAny[];
    return options.map(o => zodToTypeScript(o, indent)).join(" | ");
  }

  // Check primitive types by constructor name
  if (constructor === "ZodString" || constructor === "ZodUUID") return "string";
  if (constructor === "ZodNumber") return "number";
  if (constructor === "ZodBoolean") return "boolean";

  // Fallback for unknown types
  return "unknown";
}

function generateTypes(commands: CommandMetadata[], queries: { admin: QueryMetadata[]; public: QueryMetadata[] }): string {
  let output = `/**
 * Generated types for Ecommerce API SDK
 *
 * DO NOT EDIT MANUALLY - This file is auto-generated
 * Run: bun run sdk:generate
 *
 * Generated at: ${new Date().toISOString()}
 */

`;

  // Generate command types
  output += "// ==================== COMMAND TYPES ====================\n\n";

  for (const cmd of commands) {
    const typeStr = zodToTypeScript(cmd.schema, 2);
    output += `export type ${cmd.typeName} = ${typeStr};\n\n`;
  }

  // Generate query types
  output += "// ==================== QUERY TYPES ====================\n\n";

  const allQueries = [...queries.admin, ...queries.public];
  const uniqueQueries = Array.from(new Map(allQueries.map(q => [q.typeName, q])).values());

  for (const query of uniqueQueries) {
    const typeStr = zodToTypeScript(query.schema, 2);
    output += `export type ${query.typeName} = ${typeStr};\n\n`;
  }

  // Generate shared types
  output += `// ==================== SHARED TYPES ====================

export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string } };

export type CommandResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: { message: string } };
`;

  return output;
}

function generateClient(commands: CommandMetadata[], queries: { admin: QueryMetadata[]; public: QueryMetadata[] }): string {
  let output = `/**
 * Generated SDK client for Ecommerce API
 *
 * DO NOT EDIT MANUALLY - This file is auto-generated
 * Run: bun run sdk:generate
 *
 * Generated at: ${new Date().toISOString()}
 */

import type * as Types from './types';

export interface SDKConfig {
  /** Base URL of the API (e.g., "https://api.example.com" or "http://localhost:3000") */
  baseUrl: string;

  /** Authentication token for admin endpoints */
  authToken?: string;
}

export class EcommerceSDK {
  constructor(private config: SDKConfig) {}

  /** Admin operations (requires authToken) */
  admin = {
    /** Admin commands */
    commands: {
`;

  // Generate command methods
  for (const cmd of commands) {
    output += `      ${cmd.name}: async (payload: Omit<Types.${cmd.typeName}, "type">): Promise<Types.CommandResult> => {
        return this.executeCommand("/admin/api/commands", "${cmd.name}", payload);
      },

`;
  }

  output += `    },

    /** Admin queries */
    queries: {
`;

  // Generate admin query methods
  for (const query of queries.admin) {
    output += `      ${query.name}: async (params?: Types.${query.typeName}): Promise<Types.Result<unknown>> => {
        return this.executeQuery("/admin/api/queries", "${query.name}", params);
      },

`;
  }

  output += `    }
  };

  /** Public operations (no auth required) */
  public = {
    /** Public queries */
    queries: {
`;

  // Generate public query methods
  for (const query of queries.public) {
    output += `      ${query.name}: async (params?: Types.${query.typeName}): Promise<Types.Result<unknown>> => {
        return this.executeQuery("/api/queries", "${query.name}", params);
      },

`;
  }

  output += `    }
  };

  private async executeCommand(endpoint: string, type: string, payload: unknown): Promise<Types.CommandResult> {
    const response = await fetch(\`\${this.config.baseUrl}\${endpoint}\`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.config.authToken && { "Authorization": \`Bearer \${this.config.authToken}\` })
      },
      body: JSON.stringify({ type, payload })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      return { success: false, error };
    }

    return await response.json();
  }

  private async executeQuery(endpoint: string, type: string, params?: unknown): Promise<Types.Result<unknown>> {
    const response = await fetch(\`\${this.config.baseUrl}\${endpoint}\`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.config.authToken && { "Authorization": \`Bearer \${this.config.authToken}\` })
      },
      body: JSON.stringify({ type, params })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      return { success: false, error };
    }

    return await response.json();
  }
}
`;

  return output;
}

function generateIndex(): string {
  return `/**
 * Ecommerce API SDK
 *
 * Generated at: ${new Date().toISOString()}
 */

export { EcommerceSDK } from './client';
export type { SDKConfig } from './client';
export type * from './types';
`;
}

function generatePackageJson(): string {
  return JSON.stringify({
    name: "@yourorg/ecommerce-sdk",
    version: "1.0.0",
    description: "TypeScript SDK for Ecommerce API",
    main: "./dist/index.js",
    types: "./dist/index.d.ts",
    exports: {
      ".": {
        import: "./dist/index.js",
        types: "./dist/index.d.ts"
      }
    },
    files: ["dist"],
    scripts: {
      build: "tsc",
      prepublishOnly: "bun run build"
    },
    keywords: ["ecommerce", "sdk", "api-client", "typescript"],
    devDependencies: {
      typescript: "^5.0.0"
    }
  }, null, 2);
}

function generateTsConfig(): string {
  return JSON.stringify({
    compilerOptions: {
      target: "ES2020",
      module: "ESNext",
      lib: ["ES2020", "DOM"],
      declaration: true,
      outDir: "./dist",
      rootDir: "./src",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      moduleResolution: "bundler"
    },
    include: ["src/**/*"],
    exclude: ["node_modules", "dist"]
  }, null, 2);
}

function generateReadme(commands: CommandMetadata[], queries: { admin: QueryMetadata[]; public: QueryMetadata[] }): string {
  return `# Ecommerce API SDK

TypeScript SDK for the Ecommerce API with full type safety.

## Installation

\`\`\`bash
npm install @yourorg/ecommerce-sdk
\`\`\`

## Usage

\`\`\`typescript
import { EcommerceSDK } from '@yourorg/ecommerce-sdk';

const sdk = new EcommerceSDK({
  baseUrl: 'https://api.example.com',
  authToken: 'your-admin-token'  // Required for admin operations
});

// Execute a command
const result = await sdk.admin.commands.createProduct({
  id: 'product-id',
  correlationId: 'correlation-id',
  userId: 'user-id',
  title: 'My Product',
  slug: 'my-product',
  collectionIds: ['collection-1'],
  taxable: true
});

if (result.success) {
  console.log('Product created successfully');
} else {
  console.error('Error:', result.error.message);
}

// Execute a query
const products = await sdk.admin.queries.productListView({
  status: 'active',
  limit: 10
});

if (products.success) {
  console.log('Found products:', products.data);
}
\`\`\`

## Public API

For public queries (no authentication required):

\`\`\`typescript
const sdk = new EcommerceSDK({
  baseUrl: 'https://api.example.com'
  // No authToken needed
});

const products = await sdk.public.queries.productListView({
  status: 'active'
});
\`\`\`

## API Reference

### Admin Commands (${commands.length} total)

${commands.map(cmd => `- \`sdk.admin.commands.${cmd.name}()\``).join("\n")}

### Admin Queries (${queries.admin.length} total)

${queries.admin.map(q => `- \`sdk.admin.queries.${q.name}()\``).join("\n")}

### Public Queries (${queries.public.length} total)

${queries.public.map(q => `- \`sdk.public.queries.${q.name}()\``).join("\n")}

## Type Safety

All commands and queries are fully typed. Import types as needed:

\`\`\`typescript
import type { CreateProductCommand, GetProductListQuery } from '@yourorg/ecommerce-sdk';
\`\`\`

## Development

This SDK is auto-generated. Do not edit the files in \`clientSDK/src\` manually.

To regenerate:
\`\`\`bash
bun run sdk:generate
\`\`\`

## License

MIT
`;
}

function generateGitignore(): string {
  return `node_modules
dist
*.log
.DS_Store
`;
}

async function main() {
  console.log("🔨 Generating SDK package...\n");

  // Collect commands and queries
  console.log("📋 Collecting commands...");
  const commands = collectCommands();
  console.log(`   Found ${commands.length} commands`);

  console.log("📋 Collecting queries...");
  const queries = collectQueries();
  console.log(`   Found ${queries.admin.length} admin queries, ${queries.public.length} public queries`);

  // Create clientSDK directory at top level of packages
  const sdkDir = "../clientSDK";
  const srcDir = join(sdkDir, "src");

  console.log("\n📁 Creating package structure...");
  await mkdir(sdkDir, { recursive: true });
  await mkdir(srcDir, { recursive: true });

  // Generate files
  console.log("📝 Generating types...");
  const types = generateTypes(commands, queries);
  await Bun.write(join(srcDir, "types.ts"), types);

  console.log("📝 Generating client...");
  const client = generateClient(commands, queries);
  await Bun.write(join(srcDir, "client.ts"), client);

  console.log("📝 Generating index...");
  const index = generateIndex();
  await Bun.write(join(srcDir, "index.ts"), index);

  console.log("📝 Generating package.json...");
  const packageJson = generatePackageJson();
  await Bun.write(join(sdkDir, "package.json"), packageJson);

  console.log("📝 Generating tsconfig.json...");
  const tsconfig = generateTsConfig();
  await Bun.write(join(sdkDir, "tsconfig.json"), tsconfig);

  console.log("📝 Generating README.md...");
  const readme = generateReadme(commands, queries);
  await Bun.write(join(sdkDir, "README.md"), readme);

  console.log("📝 Generating .gitignore...");
  const gitignore = generateGitignore();
  await Bun.write(join(sdkDir, ".gitignore"), gitignore);

  console.log("\n✅ SDK package generated successfully!\n");
  console.log("📦 Package location: packages/clientSDK/");
  console.log("📊 Statistics:");
  console.log(`   - Commands: ${commands.length}`);
  console.log(`   - Admin Queries: ${queries.admin.length}`);
  console.log(`   - Public Queries: ${queries.public.length}`);
  console.log("\n📖 Next steps:");
  console.log("   1. cd clientSDK");
  console.log("   2. bun install");
  console.log("   3. bun run build");
  console.log("   4. (Optional) npm publish\n");
}

main().catch((error) => {
  console.error("\n❌ Error:", error.message);
  console.error(error.stack);
  process.exit(1);
});
