import type { TeamMember } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth/guards";
import { deleteUnusedMedia } from "@/lib/storage/media";
import type { TeamInput, TeamPatch } from "@/lib/validation/team";

// Our Team: the queries behind /api/v1/team (public) and /api/v1/admin/team.
// Order is `position` (0 first): the About page shows the first six, the Team page everyone.

/** The frontend's TeamMember shape. Optional fields are left out when empty, as the frontend expects. */
export type TeamOut = {
  id: number; name: string; role: string; img: string | null;
  department?: string; bio?: string; experienceYears?: number; specialities?: string[]; languages?: string[];
  phone?: string; whatsapp?: string; email?: string;
  position: number;
};

export function toMember(m: TeamMember): TeamOut {
  return {
    id: m.id, name: m.name, role: m.role, img: m.photoUrl,
    ...(m.department ? { department: m.department } : {}),
    ...(m.bio ? { bio: m.bio } : {}),
    ...(m.experienceYears ? { experienceYears: m.experienceYears } : {}),
    ...(m.specialities.length ? { specialities: m.specialities } : {}),
    ...(m.languages.length ? { languages: m.languages } : {}),
    ...(m.phone ? { phone: m.phone } : {}),
    ...(m.whatsapp ? { whatsapp: m.whatsapp } : {}),
    ...(m.email ? { email: m.email } : {}),
    position: m.position,
  };
}

const ORDER = [{ position: "asc" as const }, { id: "asc" as const }];
const notFound = (): HttpError => new HttpError(404, "NOT_FOUND", "Team member not found");

/** Everyone, in display order (public: the cards and profiles show all of it). */
export async function listTeam(): Promise<TeamOut[]> {
  return (await prisma.teamMember.findMany({ orderBy: ORDER })).map(toMember);
}

export async function getMember(id: number): Promise<TeamOut> {
  const row = await prisma.teamMember.findUnique({ where: { id } });
  if (!row) throw notFound();
  return toMember(row);
}

/** A new member goes last, as the editor shows it. */
export async function createMember(v: TeamInput): Promise<TeamOut> {
  const last = await prisma.teamMember.aggregate({ _max: { position: true } });
  const row = await prisma.teamMember.create({ data: { ...v, position: (last._max.position ?? -1) + 1 } });
  return toMember(row);
}

/** Changes only the sent fields. A replaced or removed photo is deleted from storage. */
export async function updateMember(id: number, patch: TeamPatch): Promise<TeamOut> {
  const saved = await prisma.teamMember.findUnique({ where: { id } });
  if (!saved) throw notFound();
  const row = await prisma.teamMember.update({ where: { id }, data: patch });
  if (saved.photoUrl && row.photoUrl !== saved.photoUrl) await deleteUnusedMedia([saved.photoUrl]);
  return toMember(row);
}

/** Removed for good (the admin confirms first), with their photo. Their articles keep authorName. */
export async function deleteMember(id: number): Promise<void> {
  const row = await prisma.teamMember.findUnique({ where: { id }, select: { photoUrl: true } });
  if (!row) throw notFound();
  await prisma.teamMember.delete({ where: { id } });
  await deleteUnusedMedia([row.photoUrl]);
}

/** Sets the display order. `ids` must be every member exactly once. */
export async function reorderTeam(ids: number[]): Promise<TeamOut[]> {
  const all = await prisma.teamMember.findMany({ select: { id: true } });
  const known = new Set(all.map((m) => m.id));
  if (ids.length !== known.size || ids.some((id) => !known.has(id))) {
    throw new HttpError(409, "CONFLICT", "The team list has changed. Reload and try again.");
  }
  await prisma.$transaction(ids.map((id, position) => prisma.teamMember.update({ where: { id }, data: { position } })));
  return listTeam();
}
