// npm run db:seed-articles — puts the 4 sample journal articles (the ones the frontend used to
// hard-code in data/content.ts → BLOGS) into the database, through the same createArticle() the
// admin API uses. Runs only on an empty Article table; restarts the id sequence at 1 so they get
// ids 1-4 again. For testing: edit or delete them from the admin later.
export {};

const img = (id: string): string => `https://images.unsplash.com/${id}?w=800&h=500&fit=crop&auto=format`;

/** In display order (the first is the featured story). `month` is when it was published. */
const SAMPLES = [
  { category: "Market Update", month: "2025-05", title: "Nepal Real Estate Rebounds: Q1 2025 Market Report",
    excerpt: "After a cautious 2024, Nepal's property market has shown strong signs of recovery in Q1 2025, with Kathmandu Valley recording a 14% uptick in premium transactions.",
    coverUrl: img("photo-1544735716-392fe2489ffa") },
  { category: "Buyer's Guide", month: "2025-04", title: "How to Buy Property in Nepal: The Complete 2025 Guide",
    excerpt: "From land registration to bank financing, we break down every step of the property purchase process in Nepal in plain language.",
    coverUrl: img("photo-1512917774080-9991f1c4c750") },
  { category: "Investment", month: "2025-03", title: "Pokhara International Airport: What It Means for Property Prices",
    excerpt: "Pokhara's new international airport has catalyzed a significant shift in property values across the western region. Here's what investors need to know.",
    coverUrl: img("photo-1600585154526-990dced4db0d") },
  { category: "Vastu", month: "2025-02", title: "Vastu Shastra for Modern Homes: Principles That Still Work",
    excerpt: "Ancient Vastu principles continue to influence homebuying decisions in Nepal. Our consultants explain which guidelines genuinely improve living quality.",
    coverUrl: img("photo-1600596542815-ffad4c1539a9") },
];

async function main(): Promise<void> {
  try {
    process.loadEnvFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  // Imported after loadEnvFile(), so lib/prisma.ts sees DATABASE_URL (see prisma/seed.ts).
  const { prisma } = await import("@/lib/prisma");
  const { createArticle } = await import("@/lib/content/articles");
  const { articleInputSchema } = await import("@/lib/validation/article");

  try {
    const existing = await prisma.article.count();
    if (existing > 0) {
      console.log(`Not seeding: the Article table already has ${existing} row(s). Delete them first to re-seed.`);
      return;
    }
    await prisma.$executeRawUnsafe(`ALTER SEQUENCE "Article_id_seq" RESTART WITH 1`);
    // createArticle puts each new article first, so add them last-to-first.
    for (const s of [...SAMPLES].reverse()) {
      const a = await createArticle(articleInputSchema.parse({
        title: s.title, category: s.category, excerpt: s.excerpt, coverUrl: s.coverUrl,
        publishedAt: `${s.month}-01T00:00:00.000Z`,
      }));
      console.log(`id ${a.id}  ${a.slug}`);
    }
    console.log(`Seeded ${SAMPLES.length} sample articles.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
