// npm run db:seed-team — puts the 3 sample team members (the ones the frontend used to hard-code
// in data/content.ts → TEAM) into the database, through the same createMember() the admin API uses.
// Runs only on an empty TeamMember table; restarts the id sequence at 1 so they get ids 1-3 again.
// For testing: edit or remove them from the admin later.
export {};

const img = (id: string): string => `https://images.unsplash.com/${id}?w=500&h=600&fit=crop&auto=format`;

/** In display order. */
const SAMPLES = [
  { name: "Arjun Thapa", role: "Founder & Principal Advisor", photoUrl: img("photo-1560250097-0b93528c311a"),
    department: "Leadership", experienceYears: 18, languages: ["Nepali", "English", "Hindi"],
    specialities: ["Luxury Residences", "Investment Advisory", "Heritage Homes"],
    bio: "Arjun founded Nepal Bhoomi to bring honesty and discretion to the valley's premium property market. He personally advises on the firm's most significant transactions.",
    phone: "+977 1 400 0000", whatsapp: "9779800000000", email: "arjun@nepalbhoomi.com" },
  { name: "Priya Shrestha", role: "Senior Property Consultant", photoUrl: img("photo-1573496359142-b8d87734a5a2"),
    department: "Sales & Advisory", experienceYears: 11, languages: ["Nepali", "English", "Newari"],
    specialities: ["Family Homes", "Lalitpur & Patan", "First-time Buyers"],
    bio: "Priya guides families through every step of buying in Lalitpur and Patan, from the first viewing to the final handover, with a calm eye for detail.",
    phone: "+977 1 400 0001", whatsapp: "9779800000001", email: "priya@nepalbhoomi.com" },
  { name: "Rajan Maharjan", role: "Investment Specialist", photoUrl: img("photo-1507003211169-0a1dd7228f2d"),
    department: "Sales & Advisory", experienceYears: 9, languages: ["Nepali", "English"],
    specialities: ["Commercial Property", "Land & Development", "NRN Investors"],
    bio: "Rajan advises investors and NRN clients on commercial buildings and development land, with a clear view of yields, zoning and long-term value.",
    phone: "+977 1 400 0002", whatsapp: "9779800000002", email: "rajan@nepalbhoomi.com" },
];

async function main(): Promise<void> {
  try {
    process.loadEnvFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  // Imported after loadEnvFile(), so lib/prisma.ts sees DATABASE_URL (see prisma/seed.ts).
  const { prisma } = await import("@/lib/prisma");
  const { createMember } = await import("@/lib/content/team");
  const { teamInputSchema } = await import("@/lib/validation/team");

  try {
    const existing = await prisma.teamMember.count();
    if (existing > 0) {
      console.log(`Not seeding: the TeamMember table already has ${existing} row(s). Delete them first to re-seed.`);
      return;
    }
    await prisma.$executeRawUnsafe(`ALTER SEQUENCE "TeamMember_id_seq" RESTART WITH 1`);
    for (const s of SAMPLES) {
      const m = await createMember(teamInputSchema.parse(s));
      console.log(`id ${m.id}  ${m.name}`);
    }
    console.log(`Seeded ${SAMPLES.length} sample team members.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
