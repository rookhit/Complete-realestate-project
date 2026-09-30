-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('ENQUIRY', 'CALLBACK', 'CONTACT', 'EMAIL');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('NEW', 'DRAFT', 'PUBLISHED', 'REJECTED');

-- DropForeignKey
ALTER TABLE "FloorPlan" DROP CONSTRAINT "FloorPlan_propertyId_fkey";

-- DropForeignKey
ALTER TABLE "Room" DROP CONSTRAINT "Room_floorPlanId_fkey";

-- DropIndex
DROP INDEX "Property_ref_key";

-- AlterTable
ALTER TABLE "Property" DROP COLUMN "furnishing",
DROP COLUMN "ref",
ADD COLUMN     "floorPlan" JSONB,
ADD COLUMN     "landAreaRapd" TEXT,
ADD COLUMN     "landAreaSqft" INTEGER,
ADD COLUMN     "nbNumber" INTEGER NOT NULL,
DROP COLUMN "type",
ADD COLUMN     "type" TEXT NOT NULL,
DROP COLUMN "badge",
ADD COLUMN     "badge" TEXT,
DROP COLUMN "builtAreaUnit",
ADD COLUMN     "builtAreaUnit" TEXT,
DROP COLUMN "landAreaUnit",
ADD COLUMN     "landAreaUnit" TEXT,
DROP COLUMN "facing",
ADD COLUMN     "facing" TEXT,
DROP COLUMN "roadSurface",
ADD COLUMN     "roadSurface" TEXT;

-- AlterTable
ALTER TABLE "PropertyComment" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- DropTable
DROP TABLE "FloorPlan";

-- DropTable
DROP TABLE "Room";

-- DropEnum
DROP TYPE "BuiltAreaUnit";

-- DropEnum
DROP TYPE "Facing";

-- DropEnum
DROP TYPE "Furnishing";

-- DropEnum
DROP TYPE "LandAreaUnit";

-- DropEnum
DROP TYPE "PropertyBadge";

-- DropEnum
DROP TYPE "PropertyType";

-- DropEnum
DROP TYPE "RoadSurface";

-- CreateTable
CREATE TABLE "Testimonial" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '',
    "rating" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "duration" TEXT NOT NULL DEFAULT '',
    "youtubeUrl" TEXT,
    "posterUrl" TEXT,
    "sources" JSONB,
    "captions" JSONB,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" SERIAL NOT NULL,
    "kind" "MessageKind" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "propertyId" INTEGER,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "replied" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingSubmission" (
    "id" SERIAL NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'NEW',
    "statusBeforeReject" "ListingStatus",
    "sellerName" TEXT NOT NULL,
    "sellerPhone" TEXT NOT NULL,
    "sellerEmail" TEXT,
    "title" TEXT NOT NULL,
    "listing" "ListingType" NOT NULL,
    "type" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "price" TEXT NOT NULL DEFAULT '',
    "builtArea" TEXT NOT NULL DEFAULT '',
    "landArea" TEXT NOT NULL DEFAULT '',
    "buildYear" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "amenities" TEXT[],
    "photos" TEXT[],
    "draft" JSONB,
    "propertyId" INTEGER,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Testimonial_position_idx" ON "Testimonial"("position");

-- CreateIndex
CREATE INDEX "Video_position_idx" ON "Video"("position");

-- CreateIndex
CREATE INDEX "Message_read_receivedAt_idx" ON "Message"("read", "receivedAt");

-- CreateIndex
CREATE INDEX "Message_kind_receivedAt_idx" ON "Message"("kind", "receivedAt");

-- CreateIndex
CREATE INDEX "Message_propertyId_idx" ON "Message"("propertyId");

-- CreateIndex
CREATE INDEX "Message_deletedAt_idx" ON "Message"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ListingSubmission_propertyId_key" ON "ListingSubmission"("propertyId");

-- CreateIndex
CREATE INDEX "ListingSubmission_status_receivedAt_idx" ON "ListingSubmission"("status", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Property_nbNumber_key" ON "Property"("nbNumber");

-- CreateIndex
CREATE INDEX "Property_listing_type_idx" ON "Property"("listing", "type");

-- CreateIndex
CREATE INDEX "Property_landAreaSqft_idx" ON "Property"("landAreaSqft");

-- CreateIndex
CREATE INDEX "PropertyComment_deletedAt_idx" ON "PropertyComment"("deletedAt");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingSubmission" ADD CONSTRAINT "ListingSubmission_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Checks Prisma can't express.
ALTER TABLE "Property" ADD CONSTRAINT "Property_nbNumber_positive" CHECK ("nbNumber" > 0);
ALTER TABLE "Property" ADD CONSTRAINT "Property_type_not_blank" CHECK (btrim("type") <> '');
-- Ropani-Aana-Paisa-Dam, four parts: aana 0-15, paisa 0-3, dam 0-3.
ALTER TABLE "Property" ADD CONSTRAINT "Property_landAreaRapd_format"
  CHECK ("landAreaRapd" IS NULL OR "landAreaRapd" ~ '^[0-9]+-([0-9]|1[0-5])-[0-3]-[0-3]$');
ALTER TABLE "Property" ADD CONSTRAINT "Property_landAreaSqft_non_negative" CHECK ("landAreaSqft" IS NULL OR "landAreaSqft" >= 0);
ALTER TABLE "Testimonial" ADD CONSTRAINT "Testimonial_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "Testimonial" ADD CONSTRAINT "Testimonial_name_not_blank" CHECK (btrim("name") <> '');
ALTER TABLE "Video" ADD CONSTRAINT "Video_title_not_blank" CHECK (btrim("title") <> '');
ALTER TABLE "ListingSubmission" ADD CONSTRAINT "ListingSubmission_required_not_blank"
  CHECK (btrim("title") <> '' AND btrim("sellerName") <> '' AND btrim("sellerPhone") <> '' AND btrim("district") <> '');

-- Supabase REST API lockout (see 20260924160000_enable_rls): RLS on, no policies.
ALTER TABLE "Testimonial" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Video" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SiteSetting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ListingSubmission" ENABLE ROW LEVEL SECURITY;
