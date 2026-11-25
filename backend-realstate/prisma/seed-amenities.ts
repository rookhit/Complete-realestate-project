// Adds new amenity names to the database (and fixes their order) without touching anything else.
// Unlike prisma/seed.ts it does not reset the admin user, so it is safe on the live database.
// Run: npm run db:seed-amenities
async function main(): Promise<void> {
  try {
    process.loadEnvFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  // Imported after loadEnvFile() so lib/prisma.ts sees DATABASE_URL (see seed.ts).
  const { prisma } = await import("@/lib/prisma");
  const { upsertAmenities } = await import("./amenities");
  const before = await prisma.amenity.count();
  const total = await upsertAmenities(prisma);
  console.log(`Amenities ready: ${total} in the list, ${(await prisma.amenity.count()) - before} added.`);
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

export {}; // a module, so main() does not clash with seed.ts in the type check
