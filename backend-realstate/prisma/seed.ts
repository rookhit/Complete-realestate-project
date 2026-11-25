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
    // Verified up front: the address comes from the operator's own .env, and without this a fresh
    // database's admin would be stuck behind an emailed code (or locked out with no Gmail set up).
    update: { passwordHash, role: "ADMIN", name, emailVerifiedAt: new Date() },
    create: { email: normalizedEmail, passwordHash, role: "ADMIN", name, emailVerifiedAt: new Date() },
    select: { id: true, email: true },
  });

  console.log(`Admin user ready: ${admin.email} (${admin.id})`);

  // Amenities: add missing names and fix group/order; never deletes (properties may link to old ones).
  const { upsertAmenities } = await import("./amenities");
  console.log(`Amenities ready: ${await upsertAmenities(prisma)}`);

  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
