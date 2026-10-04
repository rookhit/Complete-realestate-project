// npm run db:seed-testimonials — puts the 3 sample testimonials (the ones the frontend used to
// hard-code in data/content.ts → TESTIMONIALS) into the database, through the same
// createTestimonial() the admin API uses. Runs only on an empty Testimonial table; restarts the id
// sequence at 1 so they get ids 1-3 again. For testing: edit or delete them from the admin later.
export {};

const img = (id: string): string => `https://images.unsplash.com/${id}?w=200&h=200&fit=crop&auto=format`;

/** In display order. */
const SAMPLES = [
  { name: "Bijay Shrestha", role: "Property Buyer, Kathmandu", rating: 5, photoUrl: img("photo-1560250097-0b93528c311a"),
    text: "Nepal Bhoomi helped us find our dream home in Lalitpur within 3 weeks. Their knowledge of the market and genuine care for our needs was exceptional." },
  { name: "Anita Gurung", role: "Property Investor, Pokhara", rating: 5, photoUrl: img("photo-1573497019940-1c28c88b4f3e"),
    text: "As an NRN investing from abroad, Nepal Bhoomi's advisory team guided us through every legal and financial step. Complete transparency throughout." },
  { name: "Dr. Ramesh Poudel", role: "Commercial Buyer, Lalitpur", rating: 5, photoUrl: img("photo-1507003211169-0a1dd7228f2d"),
    text: "Purchased a commercial property through Nepal Bhoomi. Their valuation was spot-on and the transaction was completed without a single hitch. Highly recommended." },
];

async function main(): Promise<void> {
  try {
    process.loadEnvFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  // Imported after loadEnvFile(), so lib/prisma.ts sees DATABASE_URL (see prisma/seed.ts).
  const { prisma } = await import("@/lib/prisma");
  const { createTestimonial } = await import("@/lib/content/testimonials");
  const { testimonialInputSchema } = await import("@/lib/validation/testimonial");

  try {
    const existing = await prisma.testimonial.count();
    if (existing > 0) {
      console.log(`Not seeding: the Testimonial table already has ${existing} row(s). Delete them first to re-seed.`);
      return;
    }
    await prisma.$executeRawUnsafe(`ALTER SEQUENCE "Testimonial_id_seq" RESTART WITH 1`);
    for (const s of SAMPLES) {
      const t = await createTestimonial(testimonialInputSchema.parse(s));
      console.log(`id ${t.id}  ${t.name}`);
    }
    console.log(`Seeded ${SAMPLES.length} sample testimonials.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
