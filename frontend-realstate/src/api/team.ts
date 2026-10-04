// Team calls to the backend (backend-realstate/app/api/v1/team, …/admin/team).
// Every call goes through authFetch (base URL, bearer token, refresh on 401, ApiError).
import { authFetch } from "@/app/auth";
import type { TeamMember } from "@/app/data/content";

/** One member as the API sends it: the TeamMember shape (empty optional fields left out), img null = no photo. */
export type ApiMember = Omit<TeamMember, "img"> & { img: string | null; position: number };

/** What POST / PATCH /admin/team take (backend-realstate/lib/validation/team.ts). null / "" / [] = not given. */
export type MemberInput = {
  name: string; role: string; photoUrl: string | null;
  department: string | null; bio: string | null; experienceYears: number | null;
  specialities: string[]; languages: string[];
  phone: string | null; whatsapp: string | null; email: string | null;
};

/** The site's TeamMember from an API member. */
export function toMember({ img, position: _position, ...rest }: ApiMember): TeamMember {
  return { ...rest, ...(img ? { img } : {}) };
}

export async function fetchTeam(): Promise<ApiMember[]> {
  return (await authFetch<{ data: ApiMember[] }>("/team")).data;
}

export const createMember = (input: MemberInput): Promise<{ data: ApiMember }> =>
  authFetch("/admin/team", { method: "POST", body: JSON.stringify(input) });

export const updateMember = (id: number, input: Partial<MemberInput>): Promise<{ data: ApiMember }> =>
  authFetch(`/admin/team/${id}`, { method: "PATCH", body: JSON.stringify(input) });

export const deleteMemberOnServer = (id: number): Promise<void> =>
  authFetch(`/admin/team/${id}`, { method: "DELETE" });

/** Every member id in the new display order; resolves to the list in that order. */
export const reorderTeam = (ids: number[]): Promise<{ data: ApiMember[] }> =>
  authFetch("/admin/team/order", { method: "PUT", body: JSON.stringify({ ids }) });
