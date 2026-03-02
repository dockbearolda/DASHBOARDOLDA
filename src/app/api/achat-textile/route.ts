import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/achat-textile — (?archived=true for archive view)
export async function GET(req: NextRequest) {
  try {
    const archived = req.nextUrl.searchParams.get("archived") === "true";
    const rows = await prisma.achatTextile.findMany({
      where: { archived },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ rows });
  } catch (err) {
    console.error("GET /api/achat-textile:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/achat-textile — créer une ligne avec session et champs optionnels pré-remplis
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      sessionUser = "",
      client      = "",
      designation = "",
      quantite,
    } = body;

    const row = await prisma.achatTextile.create({
      data: {
        sessionUser,
        client,
        designation,
        quantite: quantite ? parseInt(quantite) : 0,
        marque: "-",
      },
    });
    return NextResponse.json({ row }, { status: 201 });
  } catch (err) {
    console.error("POST /api/achat-textile:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
