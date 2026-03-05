import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_USERS = ["loic", "charlie", "melina", "amandine"];

// GET /api/dtf-production?user=loic
export async function GET(req: NextRequest) {
  const user = req.nextUrl.searchParams.get("user");
  if (!user || !VALID_USERS.includes(user)) {
    return NextResponse.json({ error: "Utilisateur invalide" }, { status: 400 });
  }
  try {
    const rows = await prisma.dtfRow.findMany({
      where: { user },
      orderBy: { position: "asc" },
    });
    return NextResponse.json({ rows });
  } catch (err) {
    console.error("GET /api/dtf-production:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/dtf-production — créer une ligne
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user, name = "", status = "en_cours" } = body;

    if (!user || !VALID_USERS.includes(user)) {
      return NextResponse.json({ error: "Utilisateur invalide" }, { status: 400 });
    }

    const last = await prisma.dtfRow.findFirst({
      where: { user },
      orderBy: { position: "desc" },
    });
    const position = (last?.position ?? -1) + 1;

    const row = await prisma.dtfRow.create({
      data: { user, name, status, position },
    });
    return NextResponse.json({ row }, { status: 201 });
  } catch (err) {
    console.error("POST /api/dtf-production:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE /api/dtf-production?user=loic&status=termine — purger les terminés
export async function DELETE(req: NextRequest) {
  const user = req.nextUrl.searchParams.get("user");
  const status = req.nextUrl.searchParams.get("status");
  if (!user || !VALID_USERS.includes(user)) {
    return NextResponse.json({ error: "Utilisateur invalide" }, { status: 400 });
  }
  try {
    await prisma.dtfRow.deleteMany({
      where: { user, ...(status ? { status } : {}) },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/dtf-production:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
