async function main(): Promise<void> {
  try {
    process.loadEnvFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  // Imported dynamically, after loadEnvFile(), so lib/prisma.ts reads a
  // populated process.env.DATABASE_URL when it constructs the driver adapter
  // (static imports run before any top-level code in this file, including
  // the loadEnvFile() call above).
  const { prisma } = await import("@/lib/prisma");
  const { hashPassword } = await import("@/lib/auth/password");

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set to seed the admin user");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await hashPassword(password);

  const name = "Nepal Bhoomi Admin";
  const admin = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: { passwordHash, role: "ADMIN", name },
    create: { email: normalizedEmail, passwordHash, role: "ADMIN", name },
    select: { id: true, email: true },
  });

  console.log(`Admin user ready: ${admin.email} (${admin.id})`);

  // Amenities: add missing names and fix group/order; never deletes (properties may link to old ones).
  const { AMENITY_SEED } = await import("./amenities");
  let position = 0;
  for (const [group, names] of Object.entries(AMENITY_SEED) as [keyof typeof AMENITY_SEED, string[]][]) {
    for (const name of names) {
      position++;
      await prisma.amenity.upsert({
        where: { name },
        update: { group, position },
        create: { name, group, position },
      });
    }
  }
  console.log(`Amenities ready: ${position}`);

  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
