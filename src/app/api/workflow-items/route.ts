import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/workflow-items — return all workflow items
export async function GET() {
  try {
    const items = await prisma.workflowItem.findMany({
      orderBy: [{ listType: "asc" }, { position: "asc" }],
    });
    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/workflow-items error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/workflow-items — create a new workflow item
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { listType, title } = body;

    if (!listType || !title) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get the next position
    const lastItem = await prisma.workflowItem.findFirst({
      where: { listType },
      orderBy: { position: "desc" },
    });
    const position = (lastItem?.position ?? -1) + 1;

    const item = await prisma.workflowItem.create({
      data: {
        listType,
        title,
        position,
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("POST /api/workflow-items error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
