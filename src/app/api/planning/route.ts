import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/socket-server";

// GET /api/planning — return all planning items
export async function GET() {
  try {
    const items = await prisma.planningItem.findMany({
      orderBy: { position: "asc" },
    });
    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/planning error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/planning — create a new planning item
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      priority,
      clientName,
      quantity,
      designation,
      note,
      unitPrice,
      deadline,
      status,
      responsible,
      color,
      position: bodyPosition,
    } = body;

    // Position fournie par le client (optimistic UI), sinon calcul server-side
    let position = bodyPosition;
    if (position === undefined || position === null) {
      const firstItem = await prisma.planningItem.findFirst({
        orderBy: { position: "asc" },
      });
      position = (firstItem?.position ?? 1) - 1;
    }

    const item = await prisma.planningItem.create({
      data: {
        ...(id ? { id } : {}),
        priority: priority || "MOYENNE",
        clientName: clientName || "",
        quantity: quantity || 1,
        designation: designation || "",
        note: note || "",
        unitPrice: unitPrice || 0,
        deadline: deadline ? new Date(deadline) : null,
        status: status || "A_DEVISER",
        responsible: responsible || "",
        color: color || "",
        position,
      },
    });

    broadcast("planning:created", item);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("POST /api/planning error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
