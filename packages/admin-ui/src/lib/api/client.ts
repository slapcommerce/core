/**
 * API client for CQRS commands and queries
 * Zero dependencies - uses native fetch
 */

export type ApiResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: { message: string; type?: string };
};

async function sendCommand<T = unknown>(type: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch('/admin/api/commands', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ type, payload })
  });

  const result = await response.json() as ApiResult<T>;

  if (!result.success) {
    throw new Error(result.error?.message || 'Command failed');
  }

  return result.data;
}

async function sendQuery<T = unknown>(type: string, params?: Record<string, unknown>): Promise<T> {
  const response = await fetch('/admin/api/queries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ type, params })
  });

  const result = await response.json() as ApiResult<T>;

  if (!result.success) {
    throw new Error(result.error?.message || 'Query failed');
  }

  return result.data;
}

export const api = {
  command: sendCommand,
  query: sendQuery
};
