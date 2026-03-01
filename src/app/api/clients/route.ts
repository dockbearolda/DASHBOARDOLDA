import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/clients — list all clients, or search with ?search=xxx
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";

    const clients = await prisma.client.findMany({
      where: search
        ? { nom: { contains: search, mode: "insensitive" } }
        : undefined,
      orderBy: { nom: "asc" },
      include: {
        planningItems: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            designation: true,
            status: true,
            deadline: true,
            quantity: true,
            color: true,
            createdAt: true,
          },
        },
      },
    });

    return NextResponse.json({ clients });
  } catch (error) {
    console.error("GET /api/clients error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/clients — create a new client
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nom, telephone } = body;

    if (!nom?.trim()) {
      return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });
    }

    const client = await prisma.client.create({
      data: {
        nom: nom.trim(),
        telephone: telephone?.trim() ?? "",
      },
    });

    return NextResponse.json({ client }, { status: 201 });
  } catch (error) {
    console.error("POST /api/clients error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
