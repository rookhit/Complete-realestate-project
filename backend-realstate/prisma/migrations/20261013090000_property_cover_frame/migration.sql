-- Admin-adjusted framing of the cover photo on cards, the home banner and the map card:
-- { src, x, y, zoom } (see schema.prisma). Nullable, so existing properties stay centred. 2026-10-13.
ALTER TABLE "Property" ADD COLUMN "coverFrame" JSONB;
