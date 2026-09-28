-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('FOR_SALE', 'FOR_RENT');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('HOUSE_BUNGALOW', 'LAND', 'APARTMENT', 'COMMERCIAL', 'FLAT');

-- CreateEnum
CREATE TYPE "PropertyBadge" AS ENUM ('HOT', 'FEATURED', 'NEW', 'PRIME', 'RARE', 'VERIFIED', 'EXCLUSIVE');

-- CreateEnum
CREATE TYPE "Furnishing" AS ENUM ('UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED');

-- CreateEnum
CREATE TYPE "Facing" AS ENUM ('NORTH', 'NORTH_EAST', 'EAST', 'SOUTH_EAST', 'SOUTH', 'SOUTH_WEST', 'WEST', 'NORTH_WEST');

-- CreateEnum
CREATE TYPE "RoadSurface" AS ENUM ('BLACK_TOPPED', 'CONCRETE', 'GRAVELED', 'EARTHEN');

-- CreateEnum
CREATE TYPE "LandAreaUnit" AS ENUM ('ROPANI', 'AANA', 'BIGHA', 'KATTHA', 'DHUR', 'SQ_FT');

-- CreateEnum
CREATE TYPE "BuiltAreaUnit" AS ENUM ('SQ_FT', 'SQ_M');

-- CreateEnum
CREATE TYPE "AmenityGroup" AS ENUM ('MAIN_FEATURES', 'ROOMS', 'FURNISHED');

-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('PENDING', 'PUBLISHED', 'REJECTED');

-- CreateTable
CREATE TABLE "Property" (
    "id" SERIAL NOT NULL,
    "ref" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tagline" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "listing" "ListingType" NOT NULL,
    "type" "PropertyType" NOT NULL,
    "badge" "PropertyBadge",
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "price" BIGINT,
    "furnishing" "Furnishing",
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "floors" INTEGER,
    "buildYear" INTEGER,
    "builtAreaValue" DECIMAL(12,2),
    "builtAreaUnit" "BuiltAreaUnit",
    "landAreaValue" DECIMAL(12,2),
    "landAreaUnit" "LandAreaUnit",
    "facing" "Facing",
    "roadSurface" "RoadSurface",
    "roadWidthFt" INTEGER,
    "gallery" TEXT[],
    "highlights" TEXT[],
    "reactionCount" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyLocation" (
    "id" SERIAL NOT NULL,
    "propertyId" INTEGER NOT NULL,
    "district" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "googleMapsUrl" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "mapX" INTEGER NOT NULL DEFAULT 50,
    "mapY" INTEGER NOT NULL DEFAULT 50,

    CONSTRAINT "PropertyLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Amenity" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "group" "AmenityGroup" NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Amenity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyAmenity" (
    "propertyId" INTEGER NOT NULL,
    "amenityId" INTEGER NOT NULL,

    CONSTRAINT "PropertyAmenity_pkey" PRIMARY KEY ("propertyId","amenityId")
);

-- CreateTable
CREATE TABLE "FloorPlan" (
    "id" SERIAL NOT NULL,
    "propertyId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "imageUrl" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FloorPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" SERIAL NOT NULL,
    "floorPlanId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "dimensions" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyReaction" (
    "userId" TEXT NOT NULL,
    "propertyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyReaction_pkey" PRIMARY KEY ("userId","propertyId")
);

-- CreateTable
CREATE TABLE "PropertyComment" (
    "id" SERIAL NOT NULL,
    "propertyId" INTEGER NOT NULL,
    "userId" TEXT,
    "authorName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "status" "CommentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "department" TEXT,
    "bio" TEXT,
    "experienceYears" INTEGER,
    "specialities" TEXT[],
    "languages" TEXT[],
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "coverUrl" TEXT NOT NULL,
    "authorId" INTEGER,
    "authorName" TEXT NOT NULL,
    "readingMinutes" INTEGER NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Property_ref_key" ON "Property"("ref");

-- CreateIndex
CREATE INDEX "Property_listing_type_idx" ON "Property"("listing", "type");

-- CreateIndex
CREATE INDEX "Property_featured_idx" ON "Property"("featured");

-- CreateIndex
CREATE INDEX "Property_price_idx" ON "Property"("price");

-- CreateIndex
CREATE INDEX "Property_createdAt_idx" ON "Property"("createdAt");

-- CreateIndex
CREATE INDEX "Property_deletedAt_idx" ON "Property"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyLocation_propertyId_key" ON "PropertyLocation"("propertyId");

-- CreateIndex
CREATE INDEX "PropertyLocation_district_idx" ON "PropertyLocation"("district");

-- CreateIndex
CREATE UNIQUE INDEX "Amenity_name_key" ON "Amenity"("name");

-- CreateIndex
CREATE INDEX "PropertyAmenity_amenityId_idx" ON "PropertyAmenity"("amenityId");

-- CreateIndex
CREATE INDEX "FloorPlan_propertyId_idx" ON "FloorPlan"("propertyId");

-- CreateIndex
CREATE INDEX "Room_floorPlanId_idx" ON "Room"("floorPlanId");

-- CreateIndex
CREATE INDEX "PropertyReaction_propertyId_idx" ON "PropertyReaction"("propertyId");

-- CreateIndex
CREATE INDEX "PropertyComment_propertyId_status_createdAt_idx" ON "PropertyComment"("propertyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PropertyComment_userId_idx" ON "PropertyComment"("userId");

-- CreateIndex
CREATE INDEX "TeamMember_position_idx" ON "TeamMember"("position");

-- CreateIndex
CREATE UNIQUE INDEX "Article_slug_key" ON "Article"("slug");

-- CreateIndex
CREATE INDEX "Article_position_idx" ON "Article"("position");

-- CreateIndex
CREATE INDEX "Article_publishedAt_idx" ON "Article"("publishedAt");

-- AddForeignKey
ALTER TABLE "PropertyLocation" ADD CONSTRAINT "PropertyLocation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAmenity" ADD CONSTRAINT "PropertyAmenity_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAmenity" ADD CONSTRAINT "PropertyAmenity_amenityId_fkey" FOREIGN KEY ("amenityId") REFERENCES "Amenity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloorPlan" ADD CONSTRAINT "FloorPlan_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_floorPlanId_fkey" FOREIGN KEY ("floorPlanId") REFERENCES "FloorPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyReaction" ADD CONSTRAINT "PropertyReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyReaction" ADD CONSTRAINT "PropertyReaction_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyComment" ADD CONSTRAINT "PropertyComment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyComment" ADD CONSTRAINT "PropertyComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Rules Prisma can't express. The API validates the same things; these are the last line of defence.
ALTER TABLE "Property" ADD CONSTRAINT "Property_title_not_blank" CHECK (btrim("title") <> '');
ALTER TABLE "Property" ADD CONSTRAINT "Property_price_positive" CHECK ("price" IS NULL OR "price" > 0);
ALTER TABLE "Property" ADD CONSTRAINT "Property_reactionCount_non_negative" CHECK ("reactionCount" >= 0);
ALTER TABLE "Property" ADD CONSTRAINT "Property_counts_non_negative"
  CHECK (("bedrooms" IS NULL OR "bedrooms" >= 0) AND ("bathrooms" IS NULL OR "bathrooms" >= 0) AND ("floors" IS NULL OR "floors" >= 0));
ALTER TABLE "PropertyLocation" ADD CONSTRAINT "PropertyLocation_district_not_blank" CHECK (btrim("district") <> '');
ALTER TABLE "PropertyLocation" ADD CONSTRAINT "PropertyLocation_map_range"
  CHECK ("mapX" BETWEEN 0 AND 100 AND "mapY" BETWEEN 0 AND 100);
ALTER TABLE "PropertyComment" ADD CONSTRAINT "PropertyComment_rating_range" CHECK ("rating" BETWEEN 1 AND 5);

-- Lock every new table out of Supabase's REST API (see 20260924160000_enable_rls).
ALTER TABLE "Property" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PropertyLocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Amenity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PropertyAmenity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FloorPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Room" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PropertyReaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PropertyComment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeamMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Article" ENABLE ROW LEVEL SECURITY;
