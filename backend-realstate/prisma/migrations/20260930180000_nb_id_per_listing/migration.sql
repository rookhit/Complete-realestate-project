-- DropIndex
DROP INDEX "Property_nbNumber_key";

-- CreateIndex
CREATE INDEX "Property_listing_nbNumber_idx" ON "Property"("listing", "nbNumber");


-- NB ID: NBS (FOR_SALE) and NBL (FOR_RENT) are separate sequences, and a deleted property frees its
-- number, so the full NB ID (listing + number) is unique among live rows only.
CREATE UNIQUE INDEX "Property_nb_id_live_key" ON "Property" ("listing", "nbNumber") WHERE "deletedAt" IS NULL;
