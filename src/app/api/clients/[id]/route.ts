import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/clients/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { nom, codePostal, ville, telephone } = body;

    const data: Record<string, string> = {};
    if (nom        !== undefined) data.nom        = nom.trim();
    if (codePostal !== undefined) data.codePostal = codePostal.trim();
    if (ville      !== undefined) data.ville      = ville.trim();
    if (telephone  !== undefined) data.telephone  = telephone.trim();

    const client = await prisma.client.update({ where: { id }, data });
    return NextResponse.json({ client });
  } catch (error) {
    console.error("PATCH /api/clients/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/clients/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.client.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/clients/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
