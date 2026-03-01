import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/clients/[id]/contacts — créer un contact
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;
    const body = await req.json();
    const { nom = "", fonction = "", telephone = "", email = "" } = body;

    // Position = dernier + 1
    const last = await prisma.clientContact.findFirst({
      where:   { clientId },
      orderBy: { position: "desc" },
      select:  { position: true },
    });

    const contact = await prisma.clientContact.create({
      data: {
        clientId,
        nom:       nom.trim(),
        fonction:  fonction.trim(),
        telephone: telephone.trim(),
        email:     email.trim(),
        position:  (last?.position ?? -1) + 1,
      },
    });

    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    console.error("POST /api/clients/[id]/contacts error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
