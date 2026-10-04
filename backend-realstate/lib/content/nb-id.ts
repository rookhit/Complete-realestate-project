import type { ListingType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// The NB ID: the reference the admin gives a property, "NBS" + number for a sale, "NBL" + number for
// a rental, e.g. "NBS005". (The internal `id` is separate, generated and never shown.)
// NBS and NBL are separate sequences: NBS005 and NBL005 may both exist. The full NB ID is unique among
// live properties (partial unique index "Property_nb_id_live_key" on (listing, nbNumber) WHERE
// deletedAt IS NULL). Deleting frees the number; the lowest free number is offered first.

const PREFIX: Record<ListingType, string> = { FOR_SALE: "NBS", FOR_RENT: "NBL" };

export function formatNbId(listing: ListingType, nbNumber: number): string {
  return `${PREFIX[listing]}${String(nbNumber).padStart(3, "0")}`;
}

/**
 * "NBS005", "nbs5", "#NBS 005", "NBS-005" → { listing: FOR_SALE, nbNumber: 5 }.
 * Null unless it is a full NB ID: a bare "005" is not.
 */
export function parseNbId(input: string): { listing: ListingType; nbNumber: number } | null {
  const m = input.replace(/[#\s-]/g, "").toUpperCase().match(/^NB([SL])0*(\d{1,9})$/);
  if (!m) return null;
  const nbNumber = Number(m[2]);
  if (!Number.isSafeInteger(nbNumber) || nbNumber <= 0) return null;
  return { listing: m[1] === "S" ? "FOR_SALE" : "FOR_RENT", nbNumber };
}

type Db = Pick<typeof prisma, "property">;

/** The live property already holding this NB ID (other than `exceptId`), if any. */
export async function nbIdHolder(
  db: Db, listing: ListingType, nbNumber: number, exceptId?: number,
): Promise<{ id: number; title: string } | null> {
  return db.property.findFirst({
    where: { listing, nbNumber, deletedAt: null, ...(exceptId !== undefined ? { id: { not: exceptId } } : {}) },
    select: { id: true, title: true },
  });
}

/** The lowest free number in a sequence (gaps first). `exceptId`: its own number counts as free. */
export async function lowestFreeNumber(db: Db, listing: ListingType, exceptId?: number): Promise<number> {
  const used = await db.property.findMany({
    where: { listing, deletedAt: null, ...(exceptId !== undefined ? { id: { not: exceptId } } : {}) },
    select: { nbNumber: true },
    orderBy: { nbNumber: "asc" },
  });
  let n = 1;
  for (const { nbNumber } of used) {
    if (nbNumber > n) break;
    if (nbNumber === n) n++;
  }
  return n;
}
