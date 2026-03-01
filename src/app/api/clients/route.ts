import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CONTACT_SELECT = {
  id: true, nom: true, fonction: true, telephone: true, email: true, position: true,
};

const PLANNING_SELECT = {
  id: true, designation: true, status: true, deadline: true, quantity: true, color: true, createdAt: true,
};

// GET /api/clients
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";

    const clients = await prisma.client.findMany({
      where: search
        ? {
            OR: [
              { nom:       { contains: search, mode: "insensitive" } },
              { ville:     { contains: search, mode: "insensitive" } },
              { telephone: { contains: search, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { nom: "asc" },
      include: {
        contacts:      { select: CONTACT_SELECT, orderBy: { position: "asc" } },
        planningItems: { select: PLANNING_SELECT, orderBy: { createdAt: "desc" } },
      },
    });

    return NextResponse.json({ clients });
  } catch (error) {
    console.error("GET /api/clients error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/clients — créer un nouveau client
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nom, codePostal = "", ville = "", telephone = "" } = body;

    if (!nom?.trim()) {
      return NextResponse.json({ error: "La société est requise" }, { status: 400 });
    }

    const client = await prisma.client.create({
      data: {
        nom:       nom.trim(),
        codePostal: codePostal.trim(),
        ville:     ville.trim(),
        telephone: telephone.trim(),
      },
      include: {
        contacts:      { select: CONTACT_SELECT, orderBy: { position: "asc" } },
        planningItems: { select: PLANNING_SELECT, orderBy: { createdAt: "desc" } },
      },
    });

    return NextResponse.json({ client }, { status: 201 });
  } catch (error) {
    console.error("POST /api/clients error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
