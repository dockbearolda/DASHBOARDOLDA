import { PrismaClient } from "@/generated/prisma/client";

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    // Build time without DATABASE_URL
    console.warn("DATABASE_URL not set — Prisma will not connect to a database");
    // @ts-ignore
    return new PrismaClient();
  }

  // SQLite (local development)
  if (databaseUrl.startsWith("file:")) {
    // @ts-ignore
    return new PrismaClient();
  }

  // PostgreSQL (production)
  if (databaseUrl.startsWith("postgres")) {
    try {
      const { PrismaPg } = require("@prisma/adapter-pg");
      const { Pool } = require("pg");
      const pool = new Pool({ connectionString: databaseUrl });
      const adapter = new PrismaPg(pool);
      return new PrismaClient({ adapter } as any);
    } catch (error) {
      console.warn("PostgreSQL adapter not available, using default connection");
      // @ts-ignore
      return new PrismaClient();
    }
  }

  return new PrismaClient();
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
