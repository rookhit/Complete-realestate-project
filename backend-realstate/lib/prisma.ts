import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  var prismaClient: PrismaClient | undefined;
}

// Database connections per running copy of the backend (pg's default 10; override with
// DATABASE_POOL_MAX, e.g. lower it if Supabase reports "max client connections reached": in session
// mode, port 5432, every open connection holds one of the pooler's few). connectionTimeoutMillis:
// give up on a connection after 10 s instead of hanging (pg's default is no limit);
// idleTimeoutMillis: hand an unused connection back after 10 s.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DATABASE_POOL_MAX) || 10,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 10_000,
});

// Transactions (saves, hearts, sign-in) may wait up to 10 s for a free connection when the pool is
// busy; Prisma's default of 2 s turned a short queue into a 500 ("Unable to start a transaction in the
// given time", seen 2026-11-22). They must still finish within 10 s once started.
export const prisma: PrismaClient = globalThis.prismaClient ?? new PrismaClient({ adapter, transactionOptions: { maxWait: 10_000, timeout: 10_000 } });

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaClient = prisma;
}
