import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/track/[trackingId] — public endpoint (no auth required)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  try {
    const { trackingId } = await params;

    const item = await prisma.planningItem.findUnique({
      where: { trackingId },
      select: {
        id: true,
        trackingId: true,
        clientName: true,
        designation: true,
        quantity: true,
        status: true,
        deadline: true,
        createdAt: true,
      },
    });

    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      trackingId: item.trackingId,
      clientName: item.clientName,
      designation: item.designation,
      quantity: item.quantity,
      status: item.status,
      deadline: item.deadline?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("GET /api/track/[trackingId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
