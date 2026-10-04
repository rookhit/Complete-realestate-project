-- Testimonial photo is optional: NULL instead of "" when there is none (the site shows initials). 2026-10-01.
ALTER TABLE "Testimonial" ALTER COLUMN "photoUrl" DROP DEFAULT;
ALTER TABLE "Testimonial" ALTER COLUMN "photoUrl" DROP NOT NULL;
UPDATE "Testimonial" SET "photoUrl" = NULL WHERE "photoUrl" = '';
