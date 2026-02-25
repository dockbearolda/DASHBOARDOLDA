import { PrismaClient } from "@/generated/prisma/client";

function createPrismaClient() {
  // For build-time when DATABASE_URL is not available, return a placeholder
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL not set — Prisma will not connect to a database");
    return new (PrismaClient as any)({ datasourceUrl: "postgresql://localhost/placeholder" });
  }

  // Use PostgreSQL with PrismaPg adapter for production and development
  try {
    const { PrismaPg } = require("@prisma/adapter-pg");
    const { Pool } = require("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter } as any);
  } catch (error) {
    // Fallback if adapter not available
    console.warn("PostgreSQL adapter not available, using default connection");
    return new (PrismaClient as any)({});
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
