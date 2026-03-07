import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/socket-server";

// GET /api/workflow — return all workflow items grouped by type, sorted by position
export async function GET() {
  try {
    const items = await prisma.$queryRaw<
      { id: string; content: string; type: string; position: number; done: boolean }[]
    >`
      SELECT id, content, type, position, done
      FROM workflow_items
      ORDER BY type, position
    `;

    // Group by type
    const grouped: Record<string, { id: string; content: string; type: string; position: number; done: boolean }[]> = {
      ACHAT: [],
      STANDARD: [],
      ATELIER: [],
      DTF: [],
    };

    for (const item of items) {
      if (item.type in grouped) {
        grouped[item.type].push(item);
      }
    }

    return NextResponse.json({ items: grouped });
  } catch (error) {
    console.error("GET /api/workflow error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/workflow — create a new workflow item
export async function POST(request: NextRequest) {
  let body: { content: string; type: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { content, type } = body;

  if (!content || !type) {
    return NextResponse.json({ error: "content and type are required" }, { status: 422 });
  }

  const validTypes = ["ACHAT", "STANDARD", "ATELIER", "DTF"];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 422 });
  }

  try {
    // Get max position for this type
    const maxPos = await prisma.$queryRaw<{ max: number | null }[]>`
      SELECT MAX(position) as max FROM workflow_items WHERE type = ${type}::"WorkflowType"
    `;

    const nextPosition = (maxPos[0]?.max ?? -1) + 1;

    const item = await prisma.$queryRaw<
      { id: string; content: string; type: string; position: number; done: boolean }[]
    >`
      INSERT INTO workflow_items (id, content, type, position, done, "createdAt", "updatedAt")
      VALUES (${`wf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`}, ${content}, ${type}::"WorkflowType", ${nextPosition}, false, NOW(), NOW())
      RETURNING id, content, type, position, done
    `;

    broadcast("workflow:created", item[0]);
    return NextResponse.json({ item: item[0] });
  } catch (error) {
    console.error("POST /api/workflow error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
