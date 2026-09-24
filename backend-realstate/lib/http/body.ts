import type { z } from "zod";
import { HttpError, requireAllowedOrigin, requireJsonContentType } from "@/lib/auth/guards";

// The standard start of every state-changing JSON route: Content-Type and Origin checks,
// then parse + validate the body. Throws a 400 HttpError naming the first bad field.
export async function readJsonBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  requireJsonContentType(request);
  requireAllowedOrigin(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "VALIDATION_FAILED", "Invalid JSON body");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new HttpError(400, "VALIDATION_FAILED", issue?.message ?? "Invalid request body", {
      [String(issue?.path[0] ?? "body")]: issue?.message ?? "Invalid value",
    });
  }
  return parsed.data;
}
