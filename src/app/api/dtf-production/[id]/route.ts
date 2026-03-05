import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/dtf-production/[id] — mettre à jour une ligne
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await req.json();
    const { name, status, problem } = body;

    const row = await prisma.dtfRow.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(status !== undefined && { status }),
        ...(problem !== undefined && { problem: problem || null }),
      },
    });
    return NextResponse.json({ row });
  } catch (err) {
    console.error("PATCH /api/dtf-production/[id]:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE /api/dtf-production/[id] — supprimer une ligne
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.dtfRow.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/dtf-production/[id]:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
