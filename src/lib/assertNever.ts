/**
 * Exhaustiveness checking utility for switch statements
 *
 * Usage in switch statement:
 * ```typescript
 * switch (event.eventName) {
 *   case "product.created": { ... break; }
 *   case "product.updated": { ... break; }
 *   default:
 *     assertNever(event);
 * }
 * ```
 *
 * TypeScript will produce a compile-time error if not all cases are handled.
 * At runtime, this throws an error if an unexpected value reaches the default case.
 */
export function assertNever(value: never, message?: string): never {
  throw new Error(
    message ?? `Unhandled case: ${JSON.stringify(value)}`
  );
}
