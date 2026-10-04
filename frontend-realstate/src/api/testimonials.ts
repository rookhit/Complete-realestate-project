// Testimonial calls to the backend (backend-realstate/app/api/v1/testimonials, …/admin/testimonials).
// Every call goes through authFetch (base URL, bearer token, refresh on 401, ApiError).
import { authFetch } from "@/app/auth";
import type { Testimonial } from "@/app/data/content";

/** One testimonial as the API sends it; img null = no photo. */
export type ApiTestimonial = Omit<Testimonial, "img"> & { img: string | null; position: number };

/** What POST / PATCH /admin/testimonials take (backend-realstate/lib/validation/testimonial.ts). */
export type TestimonialInput = { name: string; role: string; rating: number; text: string; photoUrl: string | null };

/** The site's Testimonial from an API one. */
export function toTestimonial({ img, position: _position, ...rest }: ApiTestimonial): Testimonial {
  return { ...rest, ...(img ? { img } : {}) };
}

export async function fetchTestimonials(): Promise<ApiTestimonial[]> {
  return (await authFetch<{ data: ApiTestimonial[] }>("/testimonials")).data;
}

export const createTestimonial = (input: TestimonialInput): Promise<{ data: ApiTestimonial }> =>
  authFetch("/admin/testimonials", { method: "POST", body: JSON.stringify(input) });

export const updateTestimonial = (id: number, input: Partial<TestimonialInput>): Promise<{ data: ApiTestimonial }> =>
  authFetch(`/admin/testimonials/${id}`, { method: "PATCH", body: JSON.stringify(input) });

export const deleteTestimonialOnServer = (id: number): Promise<void> =>
  authFetch(`/admin/testimonials/${id}`, { method: "DELETE" });

/** Every testimonial id in the new display order; resolves to the list in that order. */
export const reorderTestimonials = (ids: number[]): Promise<{ data: ApiTestimonial[] }> =>
  authFetch("/admin/testimonials/order", { method: "PUT", body: JSON.stringify({ ids }) });
