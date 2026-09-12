import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Cached via globalThis unconditionally — not just in dev. A brand new
// PrismaClient means a brand new PrismaPg adapter means a brand new pg.Pool,
// which has to establish a fresh connection (TLS handshake + auth) before it
// can run a single query — roughly 200-300ms paid again from scratch, on
// every request, instead of once per warm process. This was previously
// gated behind `NODE_ENV !== "production"`, which (a) meant Vercel's
// serverless functions never got to reuse a client across invocations of
// the same warm instance even though nothing prevents that, and (b) still
// wasn't preventing this same rebuild-per-request from happening in local
// dev too — this is the main fix for pages loading slowly everywhere.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

globalForPrisma.prisma = prisma;
