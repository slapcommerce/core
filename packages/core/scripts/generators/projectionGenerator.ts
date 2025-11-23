import type { AggregateConfig } from "../utils/prompts";
import { writeFile } from "../utils/fileWriter";
import { toCamelCase, toKebabCase } from "../utils/templates";

export async function generateProjectionLayer(config: AggregateConfig): Promise<void> {
  const { name } = config;

  console.log("\n📦 Generating projection layer...");

  // Generate repository
  await generateRepository(config);

  // Generate projection class
  await generateProjection(config);

  // Update projection router
  await updateProjectionRouter(config);

  // Add schema to schemas.ts
  await addDatabaseSchema(config);

  // Update UnitOfWork repositories
  await updateUnitOfWorkRepositories(config);
}

async function generateRepository(config: AggregateConfig): Promise<void> {
  const { name, fields, includeStatus } = config;
  const camelName = toCamelCase(name);
  const tableName = `${camelName}_list_view`;

  // Generate type fields
  const typeFields = [
    "  aggregate_id: string",
    "  correlation_id: string",
    "  version: number",
    "  created_at: Date",
    "  updated_at: Date",
  ];

  if (includeStatus) {
    typeFields.push('  status: "draft" | "active" | "archived"');
  }

  fields.forEach((f) => {
    const type = f.type === "Date" ? "Date | null" : f.optional ? `${f.type} | null` : f.type;
    typeFields.push(`  ${f.name}: ${type}`);
  });

  // Generate INSERT fields
  const insertFields = ["aggregate_id", "correlation_id", "version", "created_at", "updated_at"];
  if (includeStatus) {
    insertFields.push("status");
  }
  fields.forEach((f) => insertFields.push(f.name));

  const insertPlaceholders = insertFields.map(() => "?").join(", ");
  const insertFieldsStr = insertFields.join(", ");

  // Generate params for save method
  const saveParams = [
    "        data.aggregate_id,",
    "        data.correlation_id,",
    "        data.version,",
    "        data.created_at.toISOString(),",
    "        data.updated_at.toISOString(),",
  ];

  if (includeStatus) {
    saveParams.push("        data.status,");
  }

  fields.forEach((f) => {
    if (f.type === "Date") {
      saveParams.push(`        data.${f.name} ? data.${f.name}.toISOString() : null,`);
    } else {
      saveParams.push(`        data.${f.name},`);
    }
  });

  const content = `import type { Database } from "bun:sqlite"
import type { TransactionBatch } from "../transactionBatch"

export type ${name}ListViewData = {
${typeFields.join("\n")}
}

export class ${name}ListViewRepository {
  private db: Database
  private batch: TransactionBatch

  constructor(db: Database, batch: TransactionBatch) {
    this.db = db
    this.batch = batch
  }

  save(data: ${name}ListViewData) {
    const statement = this.db.query(
      \`INSERT OR REPLACE INTO ${tableName} (
        ${insertFieldsStr}
      ) VALUES (${insertPlaceholders})\`
    )

    this.batch.addCommand({
      statement,
      params: [
${saveParams.join("\n")}
      ],
      type: 'insert'
    })
  }
}
`;

  const filePath = `/Users/ryanwible/projects/core/src/infrastructure/repositories/${camelName}ListViewRepository.ts`;
  await writeFile(filePath, content);
}

async function generateProjection(config: AggregateConfig): Promise<void> {
  const { name, fields, includeStatus } = config;
  const camelName = toCamelCase(name);

  // Generate field assignments for createViewData function
  const fieldAssignments = [
    "    aggregate_id: aggregateId,",
    "    correlation_id: correlationId,",
    "    version: version,",
    "    created_at: state.createdAt,",
    "    updated_at: updatedAt,",
  ];

  if (includeStatus) {
    fieldAssignments.push("    status: state.status,");
  }

  fields.forEach((f) => {
    fieldAssignments.push(`    ${f.name}: state.${f.name},`);
  });

  const content = `import type { DomainEvent } from "../../domain/_base/domainEvent"
import type { UnitOfWorkRepositories } from "../../infrastructure/unitOfWork"
import { ${name}CreatedEvent } from "../../domain/${camelName}/events"
import type { ${name}Event } from "../../domain/${camelName}/events";
import type { ${name}ListViewData } from "../../infrastructure/repositories/${camelName}ListViewRepository"
import type { ${name}State } from "../../domain/${camelName}/events"
import { assertNever } from "../../lib/assertNever";

function create${name}ListViewData(
  aggregateId: string,
  correlationId: string,
  version: number,
  state: ${name}State,
  updatedAt: Date
): ${name}ListViewData {
  return {
${fieldAssignments.join("\n")}
  }
}

export class ${name}ListViewProjection {
  constructor(private repositories: UnitOfWorkRepositories) { }

  async execute(event: ${name}Event): Promise<void> {
    const { ${camelName}ListViewRepository } = this.repositories;

    switch (event.eventName) {
      case "${camelName}.created": {
        const createdEvent = event as ${name}CreatedEvent;
        const state = createdEvent.payload.newState;

        const viewData = create${name}ListViewData(
          createdEvent.aggregateId,
          createdEvent.correlationId,
          createdEvent.version,
          state,
          createdEvent.occurredAt
        );

        ${camelName}ListViewRepository.save(viewData);
        break;
      }
      default:
        assertNever(event);
    }
  }
}
`;

  const filePath = `/Users/ryanwible/projects/core/src/projections/${camelName}/${camelName}ListViewProjection.ts`;
  await writeFile(filePath, content);
}

async function updateProjectionRouter(config: AggregateConfig): Promise<void> {
  const { name } = config;
  const camelName = toCamelCase(name);
  const filePath = "/Users/ryanwible/projects/core/src/infrastructure/routers/projectionRouter.ts";

  const file = Bun.file(filePath);
  let content = await file.text();

  // Add import
  const projectionImport = `import { ${name}ListViewProjection } from "../../projections/${camelName}/${camelName}ListViewProjection";`;
  const lastImportMatch = content.match(/import.*Projection.*from.*\n/g);
  if (lastImportMatch) {
    const lastImport = lastImportMatch[lastImportMatch.length - 1];
    if (lastImport === undefined) {
      throw new Error("Last projection import is undefined");
    }
    const lastImportIndex = content.lastIndexOf(lastImport);
    content =
      content.slice(0, lastImportIndex + lastImport.length) +
      projectionImport +
      "\n" +
      content.slice(lastImportIndex + lastImport.length);
  }

  // Add private field
  const privateField = `    private readonly ${camelName}ListView: ${name}ListViewProjection;`;
  const lastPrivateFieldMatch = content.match(/private readonly \w+: \w+Projection;/g);
  if (lastPrivateFieldMatch) {
    const lastField = lastPrivateFieldMatch[lastPrivateFieldMatch.length - 1];
    if (lastField === undefined) {
      throw new Error("Last private field is undefined");
    }
    const lastFieldIndex = content.lastIndexOf(lastField);
    content =
      content.slice(0, lastFieldIndex + lastField.length) +
      "\n" +
      privateField +
      content.slice(lastFieldIndex + lastField.length);
  }

  // Add instantiation in constructor
  const instantiation = `        this.${camelName}ListView = new ${name}ListViewProjection(repositories);`;
  const lastInstantiationMatch = content.match(
    /this\.\w+ = new \w+Projection\(repositories\);/g
  );
  if (lastInstantiationMatch) {
    const lastInst = lastInstantiationMatch[lastInstantiationMatch.length - 1];
    if (lastInst === undefined) {
      throw new Error("Last instantiation is undefined");
    }
    const lastInstIndex = content.lastIndexOf(lastInst);
    content =
      content.slice(0, lastInstIndex + lastInst.length) +
      "\n" +
      instantiation +
      content.slice(lastInstIndex + lastInst.length);
  }

  // Add switch case
  const switchCase = `            // ${name} events
            case "${camelName}.created":
                await this.${camelName}ListView.execute(event);
                break;
`;

  const lastBreakMatch = content.match(/break;\n\n            default:/);
  if (lastBreakMatch && lastBreakMatch.index !== undefined) {
    content =
      content.slice(0, lastBreakMatch.index + 7) +
      "\n" +
      switchCase +
      content.slice(lastBreakMatch.index + 7);
  }

  await Bun.write(filePath, content);
  console.log(`  ✅ Updated: ${filePath}`);
}

async function addDatabaseSchema(config: AggregateConfig): Promise<void> {
  const { name, fields, includeStatus } = config;
  const camelName = toCamelCase(name);
  const tableName = `${camelName}_list_view`;

  // Generate schema fields
  const schemaFields = [
    "    aggregate_id TEXT PRIMARY KEY,",
    "    correlation_id TEXT NOT NULL,",
    "    version INTEGER NOT NULL,",
    "    created_at TEXT NOT NULL,",
    "    updated_at TEXT NOT NULL,",
  ];

  if (includeStatus) {
    schemaFields.push('    status TEXT NOT NULL DEFAULT \'draft\',');
  }

  fields.forEach((f) => {
    let sqlType = "TEXT";
    if (f.type === "number") sqlType = "REAL";
    if (f.type === "boolean") sqlType = "INTEGER";

    const notNull = f.optional ? "" : " NOT NULL";
    schemaFields.push(`    ${f.name} ${sqlType}${notNull},`);
  });

  // Remove trailing comma from last field
  const lastIndex = schemaFields.length - 1;
  if (lastIndex < 0) {
    throw new Error("No schema fields to process");
  }
  if (schemaFields[lastIndex] === undefined) {
    throw new Error("Last schema field is undefined");
  }
  schemaFields[lastIndex] = schemaFields[lastIndex].replace(/,$/, "");

  const schema = `  \`CREATE TABLE IF NOT EXISTS ${tableName} (
${schemaFields.join("\n")}
  )\`,`;

  const indexSchema = includeStatus
    ? `  \`CREATE INDEX IF NOT EXISTS idx_${tableName}_status ON ${tableName}(status)\`,`
    : "";

  const filePath = "/Users/ryanwible/projects/core/src/infrastructure/schemas.ts";
  const file = Bun.file(filePath);
  let content = await file.text();

  // Find where to insert (before the Better Auth tables comment)
  const insertMatch = content.match(/  \/\/ Better Auth tables/);
  if (!insertMatch || insertMatch.index === undefined) {
    throw new Error("Could not find insertion point in schemas.ts");
  }

  content = content.slice(0, insertMatch.index) + schema + "\n" + (indexSchema ? indexSchema + "\n" : "") + content.slice(insertMatch.index);

  await Bun.write(filePath, content);
  console.log(`  ✅ Updated: ${filePath}`);
}

async function updateUnitOfWorkRepositories(config: AggregateConfig): Promise<void> {
  const { name } = config;
  const camelName = toCamelCase(name);
  const filePath = "/Users/ryanwible/projects/core/src/infrastructure/unitOfWork.ts";

  const file = Bun.file(filePath);
  let content = await file.text();

  // 1. Add import
  const repositoryImport = `import { ${name}ListViewRepository } from "./repositories/${camelName}ListViewRepository";`;
  const lastRepoImportMatch = content.match(/import \{ \w+Repository \} from "\.\/repositories\/\w+Repository";/g);
  if (lastRepoImportMatch) {
    const lastImport = lastRepoImportMatch[lastRepoImportMatch.length - 1];
    if (lastImport === undefined) {
      throw new Error("Last repository import is undefined");
    }
    const lastImportIndex = content.lastIndexOf(lastImport);
    content =
      content.slice(0, lastImportIndex + lastImport.length) +
      "\n" +
      repositoryImport +
      content.slice(lastImportIndex + lastImport.length);
  }

  // 2. Add to UnitOfWorkRepositories type
  const repositoryField = `  ${camelName}ListViewRepository: ${name}ListViewRepository;`;
  const repoTypeMatch = content.match(/export type UnitOfWorkRepositories = \{([^}]+)\}/s);
  if (repoTypeMatch) {
    const typeContent = repoTypeMatch[1];
    if (typeContent === undefined) {
      throw new Error("UnitOfWorkRepositories type content is undefined");
    }
    const updatedType = typeContent.trimEnd() + "\n" + repositoryField + "\n";
    content = content.replace(
      /export type UnitOfWorkRepositories = \{([^}]+)\}/s,
      `export type UnitOfWorkRepositories = {${updatedType}}`
    );
  }

  // 3. Add factory property
  const factoryProperty = `  private ${camelName}ListViewRepositoryFactory: typeof ${name}ListViewRepository;`;
  const lastFactoryMatch = content.match(/private \w+RepositoryFactory: typeof \w+Repository;/g);
  if (lastFactoryMatch) {
    const lastFactory = lastFactoryMatch[lastFactoryMatch.length - 1];
    if (lastFactory === undefined) {
      throw new Error("Last factory property is undefined");
    }
    const lastFactoryIndex = content.lastIndexOf(lastFactory);
    content =
      content.slice(0, lastFactoryIndex + lastFactory.length) +
      "\n" +
      factoryProperty +
      content.slice(lastFactoryIndex + lastFactory.length);
  }

  // 4. Add factory initialization in constructor
  const factoryInit = `    this.${camelName}ListViewRepositoryFactory = ${name}ListViewRepository;`;
  const lastFactoryInitMatch = content.match(/this\.\w+RepositoryFactory = \w+Repository;/g);
  if (lastFactoryInitMatch) {
    const lastInit = lastFactoryInitMatch[lastFactoryInitMatch.length - 1];
    if (lastInit === undefined) {
      throw new Error("Last factory initialization is undefined");
    }
    const lastInitIndex = content.lastIndexOf(lastInit);
    content =
      content.slice(0, lastInitIndex + lastInit.length) +
      "\n" +
      factoryInit +
      content.slice(lastInitIndex + lastInit.length);
  }

  // 5. Add repository instantiation in withTransaction
  const repoInstantiation = `    const ${camelName}ListViewRepository = new this.${camelName}ListViewRepositoryFactory(
      this.db,
      batch,
    );`;
  const lastRepoInstantiationMatch = content.match(/const \w+Repository = new this\.\w+RepositoryFactory\([^)]+\);/gs);
  if (lastRepoInstantiationMatch) {
    const lastInst = lastRepoInstantiationMatch[lastRepoInstantiationMatch.length - 1];
    if (lastInst === undefined) {
      throw new Error("Last repository instantiation is undefined");
    }
    const lastInstIndex = content.lastIndexOf(lastInst);
    content =
      content.slice(0, lastInstIndex + lastInst.length) +
      "\n" +
      repoInstantiation +
      content.slice(lastInstIndex + lastInst.length);
  }

  // 6. Add to repositories object
  const repoObjectField = `      ${camelName}ListViewRepository,`;
  const repoObjectMatch = content.match(/const repositories: UnitOfWorkRepositories = \{([^}]+)\};/s);
  if (repoObjectMatch) {
    const objectContent = repoObjectMatch[1];
    if (objectContent === undefined) {
      throw new Error("Repositories object content is undefined");
    }
    const updatedObject = objectContent.trimEnd() + "\n" + repoObjectField + "\n    ";
    content = content.replace(
      /const repositories: UnitOfWorkRepositories = \{([^}]+)\};/s,
      `const repositories: UnitOfWorkRepositories = {${updatedObject}};`
    );
  }

  await Bun.write(filePath, content);
  console.log(`  ✅ Updated: ${filePath}`);
}
