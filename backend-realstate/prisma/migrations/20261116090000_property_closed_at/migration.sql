-- Sold / rented-out properties: hidden from the website, kept for the admin (Admin → Sold & Rented).
-- NULL = on the website. Additive and nullable: existing rows stay on the website.
ALTER TABLE "Property" ADD COLUMN "closedAt" TIMESTAMP(3);
