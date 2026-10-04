import type { Testimonial } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth/guards";
import { deleteUnusedMedia } from "@/lib/storage/media";
import type { TestimonialInput, TestimonialPatch } from "@/lib/validation/testimonial";

// Client testimonials ("What Our Clients Say" on the home page): the queries behind
// /api/v1/testimonials (public) and /api/v1/admin/testimonials. Order is `position` (0 first).

/** The frontend's Testimonial shape; img null = no photo (the site shows initials). */
export type TestimonialOut = { id: number; name: string; role: string; rating: number; text: string; img: string | null; position: number };

export function toTestimonial(t: Testimonial): TestimonialOut {
  return { id: t.id, name: t.name, role: t.role, rating: t.rating, text: t.text, img: t.photoUrl, position: t.position };
}

const ORDER = [{ position: "asc" as const }, { id: "asc" as const }];
const notFound = (): HttpError => new HttpError(404, "NOT_FOUND", "Testimonial not found");

/** Every testimonial, in display order. */
export async function listTestimonials(): Promise<TestimonialOut[]> {
  return (await prisma.testimonial.findMany({ orderBy: ORDER })).map(toTestimonial);
}

export async function getTestimonial(id: number): Promise<TestimonialOut> {
  const row = await prisma.testimonial.findUnique({ where: { id } });
  if (!row) throw notFound();
  return toTestimonial(row);
}

/** A new testimonial goes last, as the editor shows it. */
export async function createTestimonial(v: TestimonialInput): Promise<TestimonialOut> {
  const last = await prisma.testimonial.aggregate({ _max: { position: true } });
  const row = await prisma.testimonial.create({ data: { ...v, position: (last._max.position ?? -1) + 1 } });
  return toTestimonial(row);
}

/** Changes only the sent fields. A replaced or removed photo is deleted from storage. */
export async function updateTestimonial(id: number, patch: TestimonialPatch): Promise<TestimonialOut> {
  const saved = await prisma.testimonial.findUnique({ where: { id } });
  if (!saved) throw notFound();
  const row = await prisma.testimonial.update({ where: { id }, data: patch });
  if (saved.photoUrl && row.photoUrl !== saved.photoUrl) await deleteUnusedMedia([saved.photoUrl]);
  return toTestimonial(row);
}

/** Deleted for good (the admin confirms first), with its photo. */
export async function deleteTestimonial(id: number): Promise<void> {
  const row = await prisma.testimonial.findUnique({ where: { id }, select: { photoUrl: true } });
  if (!row) throw notFound();
  await prisma.testimonial.delete({ where: { id } });
  await deleteUnusedMedia([row.photoUrl]);
}

/** Sets the display order. `ids` must be every testimonial exactly once. */
export async function reorderTestimonials(ids: number[]): Promise<TestimonialOut[]> {
  const all = await prisma.testimonial.findMany({ select: { id: true } });
  const known = new Set(all.map((t) => t.id));
  if (ids.length !== known.size || ids.some((id) => !known.has(id))) {
    throw new HttpError(409, "CONFLICT", "The testimonial list has changed. Reload and try again.");
  }
  await prisma.$transaction(ids.map((id, position) => prisma.testimonial.update({ where: { id }, data: { position } })));
  return listTestimonials();
}
