import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/clients/[id]/contacts/[contactId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const { contactId } = await params;
    const body = await req.json();
    const { nom, fonction, telephone, email } = body;

    const data: Record<string, string> = {};
    if (nom       !== undefined) data.nom       = nom.trim();
    if (fonction  !== undefined) data.fonction  = fonction.trim();
    if (telephone !== undefined) data.telephone = telephone.trim();
    if (email     !== undefined) data.email     = email.trim();

    const contact = await prisma.clientContact.update({ where: { id: contactId }, data });
    return NextResponse.json({ contact });
  } catch (error) {
    console.error("PATCH /api/clients/.../contacts/[contactId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/clients/[id]/contacts/[contactId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const { contactId } = await params;
    await prisma.clientContact.delete({ where: { id: contactId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/clients/.../contacts/[contactId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
