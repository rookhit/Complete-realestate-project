import { HttpError } from "@/lib/auth/guards";

/** A numeric route id ("/properties/12" → 12). Anything else is a 404, not a 400: no such record. */
export function idParam(value: string): number {
  const id = Number(value);
  if (!/^\d{1,9}$/.test(value) || !Number.isSafeInteger(id) || id <= 0) throw new HttpError(404, "NOT_FOUND", "Not found");
  return id;
}

/** The query string as a plain object, for zod. */
export function queryObject(request: Request): Record<string, string> {
  return Object.fromEntries(new URL(request.url).searchParams);
}
