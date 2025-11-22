export function toSnakeCase(camelCase: string): string {
  return camelCase.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

export function typeToSQLiteType(type: string): string {
  // Remove optional marker
  const cleanType = type.replace("?", "").trim();

  if (cleanType === "string") return "TEXT";
  if (cleanType === "number") return "INTEGER";
  if (cleanType === "boolean") return "INTEGER";
  if (cleanType === "Date") return "TEXT";
  if (cleanType.includes("[]")) return "TEXT"; // Arrays stored as JSON
  if (cleanType.startsWith("Record<")) return "TEXT"; // Objects stored as JSON
  if (cleanType.startsWith("{")) return "TEXT"; // Objects stored as JSON
  if (cleanType.includes("|")) return "TEXT"; // Union types

  return "TEXT"; // Default
}

export function getDefaultValueForType(type: string, providedDefault?: string): string {
  if (providedDefault) {
    return providedDefault;
  }

  const cleanType = type.replace("?", "").trim();

  if (cleanType === "string") return '""';
  if (cleanType === "number") return "0";
  if (cleanType === "boolean") return "false";
  if (cleanType === "Date") return "new Date()";
  if (cleanType === "string[]") return "[]";
  if (cleanType === "number[]") return "[]";
  if (cleanType.includes("[]")) return "[]";
  if (cleanType.startsWith("Record<")) return "{}";
  if (cleanType.startsWith("{")) return "{}";

  if (cleanType.includes("|")) {
    // For union types, try to pick the first non-null option
    const types = cleanType.split("|").map(t => t.trim().replace(/"/g, ""));
    const firstType = types.find(t => t !== "null");
    if (firstType && firstType.startsWith('"')) {
      return firstType;
    }
    return `"${firstType}"`;
  }

  return "undefined";
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function findAndReplaceInObject(
  content: string,
  objectPattern: RegExp,
  fieldName: string,
  replacement: string
): string {
  const match = content.match(objectPattern);
  if (!match) {
    throw new Error(`Could not find object pattern`);
  }

  const objectContent = match[0];
  const fieldRegex = new RegExp(`${escapeRegex(fieldName)}:\\s*[^,}]+`, "g");

  if (objectContent.match(fieldRegex)) {
    const updatedObject = objectContent.replace(fieldRegex, replacement);
    return content.replace(objectContent, updatedObject);
  }

  return content;
}

export function addFieldToObject(
  content: string,
  objectPattern: RegExp,
  fieldLine: string,
  beforeClosing: boolean = true
): string {
  const match = content.match(objectPattern);
  if (!match || match.index === undefined) {
    throw new Error(`Could not find object pattern`);
  }

  const objectContent = match[0];

  if (beforeClosing) {
    // Add before the closing brace
    const closingBraceIndex = objectContent.lastIndexOf("}");
    if (closingBraceIndex === -1) {
      throw new Error("Could not find closing brace");
    }

    // Check if there's already content before the closing brace
    const beforeClosing = objectContent.substring(0, closingBraceIndex).trim();
    const needsComma = beforeClosing.endsWith("}") || beforeClosing.endsWith('"') ||
                       beforeClosing.endsWith("'") || !beforeClosing.endsWith(",");

    const insertion = needsComma && !fieldLine.startsWith(",")
      ? `,\n    ${fieldLine}\n  `
      : `\n    ${fieldLine}\n  `;

    const updatedObject =
      objectContent.substring(0, closingBraceIndex) +
      insertion +
      objectContent.substring(closingBraceIndex);

    return content.replace(objectContent, updatedObject);
  }

  return content;
}

export function removeFieldFromObject(
  content: string,
  objectPattern: RegExp,
  fieldName: string
): string {
  const match = content.match(objectPattern);
  if (!match) {
    return content; // Field might not exist, that's okay
  }

  const objectContent = match[0];

  // Match the field line including its trailing comma and newline
  const fieldRegex = new RegExp(`\\s*${escapeRegex(fieldName)}:\\s*[^,\n]+,?\\s*\n?`, "g");
  const updatedObject = objectContent.replace(fieldRegex, "");

  return content.replace(objectContent, updatedObject);
}

export function renameFieldInContent(
  content: string,
  oldName: string,
  newName: string,
  contextPattern?: RegExp
): string {
  if (contextPattern) {
    const match = content.match(contextPattern);
    if (!match || match.index === undefined) {
      return content;
    }

    const contextContent = match[0];
    const fieldRegex = new RegExp(`\\b${escapeRegex(oldName)}\\b`, "g");
    const updatedContext = contextContent.replace(fieldRegex, newName);

    return content.replace(contextContent, updatedContext);
  }

  // Global rename
  const fieldRegex = new RegExp(`\\b${escapeRegex(oldName)}\\b`, "g");
  return content.replace(fieldRegex, newName);
}

export function updateFieldType(
  content: string,
  fieldName: string,
  newType: string,
  isPrivateField: boolean = false
): string {
  const visibility = isPrivateField ? "(private|public)" : "";
  const fieldRegex = new RegExp(
    `${visibility}\\s*${escapeRegex(fieldName)}:\\s*[^;]+;`,
    "g"
  );

  const replacement = isPrivateField
    ? `private ${fieldName}: ${newType};`
    : `${fieldName}: ${newType};`;

  return content.replace(fieldRegex, replacement);
}
