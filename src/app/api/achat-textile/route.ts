import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/achat-textile
export async function GET() {
  try {
    const rows = await prisma.achatTextile.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ rows });
  } catch (err) {
    console.error("GET /api/achat-textile:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/achat-textile — créer une ligne vide avec la session courante
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionUser = "" } = body;

    const row = await prisma.achatTextile.create({
      data: { sessionUser, marque: "-" },
    });
    return NextResponse.json({ row }, { status: 201 });
  } catch (err) {
    console.error("POST /api/achat-textile:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
