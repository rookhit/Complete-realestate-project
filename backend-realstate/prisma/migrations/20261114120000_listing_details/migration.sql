-- Free listings: the details that depend on the property type (area / street, map link, bedrooms,
-- bathrooms, floors, facing, road surface, road width), as typed on the Free Listing form.
-- Nullable: rows sent before this have none.
ALTER TABLE "ListingSubmission" ADD COLUMN "details" JSONB;
