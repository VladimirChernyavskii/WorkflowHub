import type { ApiErrorBody } from "./types";

export function parseApiError(body: unknown, status: number): string {
  const err = body as ApiErrorBody;
  return (
    err.issues?.map((i) => `${i.path}: ${i.message}`).join("; ") ||
    err.error ||
    `Request failed (${status})`
  );
}
