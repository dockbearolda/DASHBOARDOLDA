import { NextResponse } from "next/server";

/**
 * GET /api/health
 *
 * Railway health check — répond immédiatement 200 si le serveur Node tourne.
 * Ne touche PAS à Prisma : une requête DB qui hang ferait timeout le health
 * check et Railway garderait le container en "service unavailable" indéfiniment.
 */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
