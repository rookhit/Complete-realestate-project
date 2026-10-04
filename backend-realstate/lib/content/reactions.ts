import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth/guards";

// Hearts: one per signed-in user per property (PropertyReaction), the only "like" on the site.
// Property.reactionCount is the number shown: a heart adds one, removing it takes one away, and
// the admin can still set the number directly (Admin → Properties).

const isUniqueViolation = (e: unknown): boolean =>
  typeof e === "object" && e !== null && "code" in e && (e as { code: unknown }).code === "P2002";

/** Heart a property. Doing it twice changes nothing. Returns the new shown count. */
export async function addReaction(userId: string, propertyId: number): Promise<{ liked: true; reactionCount: number }> {
  const property = await prisma.property.findFirst({ where: { id: propertyId, deletedAt: null }, select: { id: true } });
  if (!property) throw new HttpError(404, "NOT_FOUND", "Property not found");
  try {
    const row = await prisma.$transaction(async (tx) => {
      await tx.propertyReaction.create({ data: { userId, propertyId } });
      return tx.property.update({ where: { id: propertyId }, data: { reactionCount: { increment: 1 } }, select: { reactionCount: true } });
    });
    return { liked: true, reactionCount: row.reactionCount };
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;   // already hearted: nothing to add
    const row = await prisma.property.findUniqueOrThrow({ where: { id: propertyId }, select: { reactionCount: true } });
    return { liked: true, reactionCount: row.reactionCount };
  }
}

/** Remove the heart. Doing it twice changes nothing. The count never goes below 0. */
export async function removeReaction(userId: string, propertyId: number): Promise<{ liked: false; reactionCount: number }> {
  const row = await prisma.$transaction(async (tx) => {
    const done = await tx.propertyReaction.deleteMany({ where: { userId, propertyId } });
    if (done.count) await tx.property.updateMany({ where: { id: propertyId, reactionCount: { gt: 0 } }, data: { reactionCount: { decrement: 1 } } });
    return tx.property.findUnique({ where: { id: propertyId }, select: { reactionCount: true } });
  });
  if (!row) throw new HttpError(404, "NOT_FOUND", "Property not found");
  return { liked: false, reactionCount: row.reactionCount };
}

/** The properties this user has hearted (live ones only). */
export async function myReactions(userId: string): Promise<number[]> {
  const rows = await prisma.propertyReaction.findMany({ where: { userId, property: { deletedAt: null } }, select: { propertyId: true } });
  return rows.map((r) => r.propertyId);
}
