import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/achat-textile/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const ALLOWED = ["client", "fournisseur", "marque", "genre", "designation", "reference", "couleur", "taille", "quantite", "livraison", "sessionUser"];
    const data: Record<string, unknown> = {};
    for (const key of ALLOWED) {
      if (body[key] !== undefined) {
        data[key] = key === "quantite" ? (parseInt(body[key]) || 1) : body[key];
      }
    }

    const row = await prisma.achatTextile.update({ where: { id }, data });
    return NextResponse.json({ row });
  } catch (err) {
    console.error("PATCH /api/achat-textile/[id]:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE /api/achat-textile/[id]
export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.achatTextile.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/achat-textile/[id]:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
