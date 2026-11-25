import { prisma } from "@/lib/prisma";
import { cardKeyOf, deleteKeys, listMedia } from "@/lib/storage/r2";

// Uploads nobody uses. Photos and videos go to R2 the moment they are picked (property editor, Free
// Listing form, journal, team…), before anything is saved; when the editor is cancelled or the form
// abandoned they stay in the bucket for ever. This finds them and, with `apply`, deletes them.
//
// Safe by design:
// - "Used" means the key appears ANYWHERE in the database: every column of every content table is
//   searched as text (row_to_json), so galleries, covers, portraits, JSON site settings and saved
//   Free Listing drafts all count, and a new table or column is covered without changing this file.
// - Only files older than `olderThanDays` (default 7) are touched, so an upload in progress, an
//   admin's open editor or a draft kept in the browser for a few days is never pulled away.
// - A photo's card copy (<uuid>.w800.jpg) is kept while its photo is used.
// - If the search finds no keys at all, nothing is deleted (a broken query must not empty the bucket),
//   and at most `limit` files go per run.

/** Tables that never hold media links (auth bookkeeping); skipped for speed. */
const NO_MEDIA = new Set([
  "RefreshToken", "PasswordResetToken", "RateLimit", "LoginLockout", "AuditLog", "EmailVerificationCode",
]);
const KEY_PATTERN = "((?:properties|articles|team|testimonials|site|listings)/[A-Za-z0-9/_.-]+)";

/** Every media key mentioned anywhere in the database. */
async function usedKeys(): Promise<Set<string>> {
  const tables = await prisma.$queryRaw<{ name: string }[]>`
    SELECT table_name AS name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name NOT LIKE '\\_prisma%'`;
  const used = new Set<string>();
  for (const { name } of tables) {
    if (NO_MEDIA.has(name) || !/^[A-Za-z0-9_]+$/.test(name)) continue;
    const rows = await prisma.$queryRawUnsafe<{ key: string }[]>(
      `SELECT DISTINCT m[1] AS key FROM "${name}" t, regexp_matches(row_to_json(t)::text, '${KEY_PATTERN}', 'g') AS m`,
    );
    for (const { key } of rows) {
      used.add(key);
      const card = cardKeyOf(key);
      if (card) used.add(card);
    }
  }
  return used;
}

export type SweepResult = { stored: number; used: number; unused: number; deleted: number; freedBytes: number; keys: string[] };

export async function sweepUnusedUploads({ apply = false, olderThanDays = 7, limit = 500 } = {}): Promise<SweepResult> {
  const [objects, used] = await Promise.all([listMedia(), usedKeys()]);
  const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
  const unused = objects.filter((o) => o.lastModified.getTime() < cutoff && !used.has(o.key)).slice(0, limit);
  const result: SweepResult = {
    stored: objects.length, used: used.size, unused: unused.length, deleted: 0,
    freedBytes: unused.reduce((n, o) => n + o.size, 0), keys: unused.map((o) => o.key),
  };
  if (!apply || unused.length === 0) return result;
  if (used.size === 0) throw new Error("Media sweep stopped: no media found in the database, refusing to delete");
  await deleteKeys(result.keys);
  result.deleted = unused.length;
  return result;
}
