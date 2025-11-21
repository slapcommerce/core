import type { UnitOfWork } from "../unitOfWork"

type Result<T> = 
  | { readonly success: true; readonly data?: T }
  | { readonly success: false; readonly error: Error }

export function createPublicCommandsRouter(
  unitOfWork: UnitOfWork,
) {
  return async (type: string, payload?: unknown): Promise<Result<void>> => {
    try {
      // Public commands router - currently empty, add public commands here as needed
      throw new Error(`Unknown command type: ${type}`)
    } catch (error) {
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) }
    }
  }
}

