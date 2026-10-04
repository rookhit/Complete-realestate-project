// npm run db:seed-samples — puts the 12 sample properties (prisma/sample-properties.ts, the listings the
// frontend used to hard-code) into the database, through the same createProperty() the admin API uses,
// so they are checked exactly like an admin save. For testing: delete them from the admin later.
//
// Runs only on an empty Property table. It then restarts the id sequence at 1, so the samples get ids
// 1-12 again: the frontend's mock reviews and messages (data/reviews.ts, data/messages.ts, still mock)
// are keyed by those ids.
import { AMENITY_SEED } from "./amenities";
import { SAMPLE_PROPERTIES, SAMPLE_REACTIONS, type SampleProp } from "./sample-properties";

const CANONICAL = new Set(Object.values(AMENITY_SEED).flat());

function areaParts(s: string): { value: number; unit: string } | null {
  const m = s.match(/^([\d,.]+)\s*(.+)$/);
  const value = m ? Number(m[1].replace(/,/g, "")) : 0;
  return m && value > 0 ? { value, unit: m[2].trim() } : null;
}

/** A sample (the frontend's Prop shape) as the admin API's input. 0 / "—" / "" = not applicable. */
function toInput(p: SampleProp) {
  const road = p.roadAccess.match(/^(.*?)\s*(\d+)\s*ft$/i);
  const rapd = p.landArea.match(/^(\d+(?:-\d+){1,3})\s*R-A-P-D$/)?.[1] ?? null;
  const orNull = (n: number): number | null => (n > 0 ? n : null);
  return {
    nbId: p.nbId, title: p.title, tagline: p.tagline, description: p.description,
    type: p.type, badge: p.badge || null, featured: p.featured, verified: p.verified,
    price: p.priceNum > 0 ? p.priceNum : null,
    bedrooms: orNull(p.beds), bathrooms: orNull(p.baths), floors: orNull(p.floors), buildYear: orNull(p.buildYear),
    builtArea: areaParts(p.builtArea), landArea: rapd ? { rapd } : areaParts(p.landArea),
    facing: p.facing || null,
    roadSurface: (road ? road[1].trim() : p.roadAccess) || null, roadWidthFt: road ? Number(road[2]) : null,
    gallery: p.gallery.length ? p.gallery : [p.hero], videoUrl: null,
    amenities: p.features.filter((f) => CANONICAL.has(f)), highlights: p.features.filter((f) => !CANONICAL.has(f)),
    floorPlan: p.floorPlan ?? null, reactionCount: SAMPLE_REACTIONS[p.id] ?? 0,
    location: { district: p.district, address: p.location, mapUrl: p.mapUrl ?? null, locationMode: p.locationMode ?? "approximate" },
  };
}

async function main(): Promise<void> {
  try {
    process.loadEnvFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  // Imported after loadEnvFile(), so lib/prisma.ts sees DATABASE_URL (see prisma/seed.ts).
  const { prisma } = await import("@/lib/prisma");
  const { createProperty } = await import("@/lib/content/properties");
  const { propertyInputSchema } = await import("@/lib/validation/property");

  try {
    const existing = await prisma.property.count();
    if (existing > 0) {
      console.log(`Not seeding: the Property table already has ${existing} row(s). Delete them first to re-seed.`);
      return;
    }
    await prisma.$executeRawUnsafe(`ALTER SEQUENCE "Property_id_seq" RESTART WITH 1`);

    for (const sample of [...SAMPLE_PROPERTIES].sort((a, b) => a.id - b.id)) {
      const { property, warnings } = await createProperty(propertyInputSchema.parse(toInput(sample)));
      const note = warnings.length ? `  (${warnings.join(" ")})` : "";
      console.log(`#${property.nbId}  id ${property.id}  ${property.title}${note}`);
      if (property.id !== sample.id) console.warn(`  note: got id ${property.id}, the sample had ${sample.id}`);
    }
    console.log(`Seeded ${SAMPLE_PROPERTIES.length} sample properties.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
