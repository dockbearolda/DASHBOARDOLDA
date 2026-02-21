import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;

  // Check if DATABASE_URL is set
  if (!dbUrl) {
    return NextResponse.json(
      {
        status: "error",
        problem: "DATABASE_URL is not set",
        fix: "Go to Railway → Your Next.js service → Variables → Add DATABASE_URL referencing your PostgreSQL service",
      },
      { status: 503 }
    );
  }

  // Mask the URL for safe display
  const masked = dbUrl.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:***@");

  // Try to query the DB
  try {
    await prisma.$queryRaw`SELECT 1`;
    const orderCount = await prisma.order.count();

    // Introspect actual enum values in DB to detect schema drift
    const enumRows = await prisma.$queryRaw<{ typname: string; enumlabel: string }[]>`
      SELECT t.typname, e.enumlabel
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname IN ('OrderStatus', 'PaymentStatus')
      ORDER BY t.typname, e.enumsortorder
    `;
    const dbEnums: Record<string, string[]> = {};
    for (const row of enumRows) {
      if (!dbEnums[row.typname]) dbEnums[row.typname] = [];
      dbEnums[row.typname].push(row.enumlabel);
    }

    return NextResponse.json({
      status: "ok",
      database: "connected",
      databaseUrl: masked,
      orders: orderCount,
      dbEnums,
      webhookSecret: process.env.WEBHOOK_SECRET ? "set" : "not set (all requests allowed)",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const isTableMissing =
      message.includes("does not exist") || message.includes("relation");

    return NextResponse.json(
      {
        status: "error",
        database: "connection failed",
        databaseUrl: masked,
        problem: isTableMissing
          ? "Tables not created — migrations have not run"
          : message,
        fix: isTableMissing
          ? "The app should run 'prisma migrate deploy' on startup — check Railway deploy logs"
          : "Check that DATABASE_URL points to the correct PostgreSQL service",
      },
      { status: 503 }
    );
  }
}
