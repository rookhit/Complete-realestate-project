import { prisma } from "@/lib/prisma";
import { deleteMedia } from "@/lib/storage/r2";

/**
 * Deletes these files from Cloudflare R2 unless something still uses them: a property's photos or
 * video (a duplicated property shares its photos with the original), an article's cover, a team
 * member's portrait, a testimonial's photo, a featured district tile or a free listing's photos
 * (a published listing shares them with its property). Links that aren't in our bucket are
 * ignored by deleteMedia. Best effort: the save or delete already happened, so a failure here is
 * only logged.
 */
export async function deleteUnusedMedia(urls: Iterable<string | null | undefined>): Promise<void> {
  const unique = [...new Set([...urls].filter((u): u is string => !!u))];
  if (!unique.length) return;
  try {
    const [properties, articles, team, testimonials, districts, listings] = await Promise.all([
      prisma.property.findMany({
        where: { OR: [{ gallery: { hasSome: unique } }, { videoUrl: { in: unique } }] },
        select: { gallery: true, videoUrl: true },
      }),
      prisma.article.findMany({ where: { coverUrl: { in: unique } }, select: { coverUrl: true } }),
      prisma.teamMember.findMany({ where: { photoUrl: { in: unique } }, select: { photoUrl: true } }),
      prisma.testimonial.findMany({ where: { photoUrl: { in: unique } }, select: { photoUrl: true } }),
      prisma.siteSetting.findUnique({ where: { key: "featuredDistricts" }, select: { value: true } }),
      prisma.listingSubmission.findMany({ where: { photos: { hasSome: unique } }, select: { photos: true } }),
    ]);
    const tiles = Array.isArray(districts?.value) ? (districts.value as { img?: unknown }[]) : [];
    const inUse = new Set([
      ...properties.flatMap((p) => [...p.gallery, ...(p.videoUrl ? [p.videoUrl] : [])]),
      ...articles.map((a) => a.coverUrl),
      ...team.map((m) => m.photoUrl ?? ""),
      ...testimonials.map((t) => t.photoUrl ?? ""),
      ...tiles.map((d) => (typeof d.img === "string" ? d.img : "")),
      ...listings.flatMap((l) => l.photos),
    ]);
    await deleteMedia(unique.filter((u) => !inUse.has(u)));
  } catch (e) {
    console.error("Deleting unused media failed", e);
  }
}
