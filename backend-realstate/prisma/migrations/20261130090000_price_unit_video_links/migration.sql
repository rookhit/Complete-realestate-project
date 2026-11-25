-- What the price is for ("per Aana", "per year"); NULL = whole property (sale) / per month (rent).
ALTER TABLE "Property" ADD COLUMN "priceUnit" TEXT;

-- Links to the property's videos on social media, in display order.
ALTER TABLE "Property" ADD COLUMN "videoLinks" TEXT[] DEFAULT ARRAY[]::TEXT[];
