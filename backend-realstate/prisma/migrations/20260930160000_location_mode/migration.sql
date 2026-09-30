-- CreateEnum
CREATE TYPE "LocationMode" AS ENUM ('APPROXIMATE', 'EXACT');

-- AlterTable
ALTER TABLE "PropertyLocation" ADD COLUMN     "approxLatitude" DECIMAL(9,6),
ADD COLUMN     "approxLongitude" DECIMAL(9,6),
ADD COLUMN     "locationMode" "LocationMode" NOT NULL DEFAULT 'APPROXIMATE';


-- The shifted centre and the real point come in pairs.
ALTER TABLE "PropertyLocation" ADD CONSTRAINT "PropertyLocation_approx_pair"
  CHECK (("approxLatitude" IS NULL) = ("approxLongitude" IS NULL));
ALTER TABLE "PropertyLocation" ADD CONSTRAINT "PropertyLocation_exact_pair"
  CHECK (("latitude" IS NULL) = ("longitude" IS NULL));
