import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/prt-requests — return all PRT requests
export async function GET() {
  try {
    const items = await prisma.pRTRequest.findMany({
      orderBy: { position: "asc" },
    });
    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/prt-requests error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/prt-requests — create a new PRT request
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientName, dimensions, design, color, quantity } = body;

    const lastItem = await prisma.pRTRequest.findFirst({
      orderBy: { position: "desc" },
    });
    const position = (lastItem?.position ?? -1) + 1;

    const item = await prisma.pRTRequest.create({
      data: {
        clientName: clientName || "",
        dimensions: dimensions || "",
        design: design || "",
        color: color || "",
        quantity: quantity || 1,
        position,
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("POST /api/prt-requests error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
