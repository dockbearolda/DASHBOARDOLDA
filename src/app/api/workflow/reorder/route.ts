import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/workflow/reorder — batch update positions for a list
export async function POST(request: NextRequest) {
  let body: { type: string; ids: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, ids } = body;

  if (!type || !Array.isArray(ids)) {
    return NextResponse.json({ error: "type and ids array are required" }, { status: 422 });
  }

  const validTypes = ["ACHAT", "STANDARD", "ATELIER", "DTF"];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 422 });
  }

  try {
    // Update positions in a single transaction
    for (let i = 0; i < ids.length; i++) {
      await prisma.$executeRaw`
        UPDATE workflow_items
        SET position = ${i}, "updatedAt" = NOW()
        WHERE id = ${ids[i]} AND type = ${type}::"WorkflowType"
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/workflow/reorder error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
