// Free listings (backend-realstate/app/api/v1/listings, …/admin/listings). Sending one is
// SIGNED-IN ONLY; the admin reviews them in Admin → Free Listings.
import { authFetch } from "@/app/auth";
import type { ListingStatus, ListingSubmission } from "@/app/data/listings";
import type { Prop } from "@/app/data/properties";

/** What the Free Listing form sends; photos are uploaded first (uploadListingPhoto). */
export type ListingInput = {
  sellerName: string; sellerPhone: string; sellerEmail: string;
  title: string; listing: "For Sale" | "For Rent"; type: string; district: string;
  price: string; builtArea: string; landArea: string; buildYear: string; description: string;
  amenities: string[]; photos: string[];
};

export const submitListing = (input: ListingInput): Promise<{ data: ListingSubmission }> =>
  authFetch("/listings", { method: "POST", body: JSON.stringify(input) });

/** Admin: every listing, newest first. */
export async function fetchListings(): Promise<ListingSubmission[]> {
  return (await authFetch<{ data: ListingSubmission[] }>("/admin/listings")).data;
}

/** Admin: status / saved draft / the property it was published as. */
export const patchListing = (id: number, patch: { status?: ListingStatus; draft?: Prop | null; propertyId?: number | null }): Promise<{ data: ListingSubmission }> =>
  authFetch(`/admin/listings/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
