import { PrismaClient } from "@/generated/prisma/client";

function createPrismaClient() {
  // Use PostgreSQL with PrismaPg adapter
  try {
    const { PrismaPg } = require("@prisma/adapter-pg");
    const { Pool } = require("pg");
    const connectionString = process.env.DATABASE_URL || "postgresql://localhost/placeholder";
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter } as any);
  } catch (error) {
    console.error("Failed to create Prisma client:", error);
    throw error;
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
