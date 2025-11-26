import type { FieldDefinition } from "./prompts";

export function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

export function toKebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

export function getTypeScriptType(type: string, optional: boolean): string {
  if (optional) {
    return `${type} | null`;
  }
  return type;
}

export function getTypeScriptDefault(type: string, optional: boolean): string {
  if (optional) {
    return "null";
  }

  if (type === "string") return '""';
  if (type === "number") return "0";
  if (type === "boolean") return "false";
  if (type === "Date") return "new Date()";
  if (type.endsWith("[]")) return "[]";
  if (type.startsWith("Record<")) return "{}";

  return "undefined";
}

export function generateStateTypeFields(
  fields: FieldDefinition[],
  includeStatus: boolean
): string {
  const fieldLines = fields.map((f) => {
    const type = getTypeScriptType(f.type, f.optional);
    return `  ${f.name}: ${type};`;
  });

  const baseFields = [
    "  id: string;",
    "  correlationId: string;",
    "  createdAt: Date;",
    "  updatedAt: Date;",
  ];

  if (includeStatus) {
    baseFields.push('  status: "draft" | "active" | "archived";');
  }

  return [...baseFields, ...fieldLines, "  [key: string]: any;"].join("\n");
}

export function generateConstructorParams(
  fields: FieldDefinition[],
  includeStatus: boolean
): string {
  const fieldLines = fields.map((f) => {
    const type = getTypeScriptType(f.type, f.optional);
    return `  ${f.name}: ${type};`;
  });

  const baseFields = [
    "  id: string;",
    "  correlationId: string;",
    "  createdAt: Date;",
    "  updatedAt: Date;",
    "  version: number;",
    "  events: DomainEvent[];",
  ];

  if (includeStatus) {
    baseFields.push('  status: "draft" | "active" | "archived";');
  }

  return [...baseFields, ...fieldLines].join("\n");
}

export function generateCreateParams(
  fields: FieldDefinition[]
): string {
  const fieldLines = fields
    .filter((f) => !f.optional) // Only required fields in create
    .map((f) => `  ${f.name}: ${f.type};`);

  return [
    "  id: string;",
    "  correlationId: string;",
    "  userId: string;",
    ...fieldLines,
  ].join("\n");
}

export function generatePrivateFields(
  fields: FieldDefinition[],
  includeStatus: boolean
): string {
  const fieldLines = fields.map((f) => {
    const type = getTypeScriptType(f.type, f.optional);
    return `  private ${f.name}: ${type};`;
  });

  const baseFields = [
    "  private correlationId: string;",
    "  private createdAt: Date;",
    "  private updatedAt: Date;",
  ];

  if (includeStatus) {
    baseFields.push('  private status: "draft" | "active" | "archived";');
  }

  return [...baseFields, ...fieldLines].join("\n");
}

export function generateConstructorAssignments(
  fields: FieldDefinition[],
  includeStatus: boolean
): string {
  const assignments = [
    "    this.id = id;",
    "    this.correlationId = correlationId;",
    "    this.createdAt = createdAt;",
    "    this.updatedAt = updatedAt;",
    "    this.version = version;",
    "    this.events = events;",
  ];

  if (includeStatus) {
    assignments.push("    this.status = status;");
  }

  fields.forEach((f) => {
    assignments.push(`    this.${f.name} = ${f.name};`);
  });

  return assignments.join("\n");
}

export function generateCreateInitialization(
  fields: FieldDefinition[],
  includeStatus: boolean
): string {
  const assignments = [
    "      id,",
    "      correlationId,",
    "      createdAt,",
    "      updatedAt: createdAt,",
    "      version: 0,",
    "      events: [],",
  ];

  if (includeStatus) {
    assignments.push('      status: "draft",');
  }

  fields.forEach((f) => {
    if (f.optional) {
      assignments.push(`      ${f.name}: null,`);
    } else {
      assignments.push(`      ${f.name},`);
    }
  });

  return assignments.join("\n");
}

export function generateToStateReturn(
  fields: FieldDefinition[],
  includeStatus: boolean
): string {
  const assignments = [
    "      id: this.id,",
    "      correlationId: this.correlationId,",
    "      createdAt: this.createdAt,",
    "      updatedAt: this.updatedAt,",
  ];

  if (includeStatus) {
    assignments.push("      status: this.status,");
  }

  fields.forEach((f) => {
    assignments.push(`      ${f.name}: this.${f.name},`);
  });

  return assignments.join("\n");
}

export function generateSnapshotFields(
  fields: FieldDefinition[],
  includeStatus: boolean
): string {
  const assignments = [
    "      id: this.id,",
    "      correlationId: this.correlationId,",
    "      createdAt: this.createdAt,",
    "      updatedAt: this.updatedAt,",
  ];

  if (includeStatus) {
    assignments.push("      status: this.status,");
  }

  fields.forEach((f) => {
    assignments.push(`      ${f.name}: this.${f.name},`);
  });

  return assignments.join("\n");
}

export function generateLoadFromSnapshotAssignments(
  fields: FieldDefinition[],
  includeStatus: boolean
): string {
  const assignments = [
    "      id: snapshot.aggregateId,",
    "      correlationId: snapshot.correlationId,",
    "      createdAt: new Date(payload.createdAt),",
    "      updatedAt: new Date(payload.updatedAt),",
    "      version: snapshot.version,",
    "      events: [],",
  ];

  if (includeStatus) {
    assignments.push("      status: payload.status,");
  }

  fields.forEach((f) => {
    if (f.type === "Date") {
      assignments.push(`      ${f.name}: payload.${f.name} ? new Date(payload.${f.name}) : null,`);
    } else {
      assignments.push(`      ${f.name}: payload.${f.name},`);
    }
  });

  return assignments.join("\n");
}

export function generateZodFields(fields: FieldDefinition[]): string {
  return fields
    .filter((f) => !f.optional)
    .map((f) => {
      let zodType = "z.string().min(1)";
      if (f.type === "number") zodType = "z.number()";
      if (f.type === "boolean") zodType = "z.boolean()";
      if (f.type === "Date") zodType = "z.date()";
      if (f.type === "string[]") zodType = "z.array(z.string())";
      if (f.type === "number[]") zodType = "z.array(z.number())";
      if (f.type.startsWith("Record<")) zodType = "z.record(z.string(), z.any())";

      return `  ${f.name}: ${zodType},`;
    })
    .join("\n");
}
