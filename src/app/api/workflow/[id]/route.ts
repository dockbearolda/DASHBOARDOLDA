import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/socket-server";

interface Params {
  params: Promise<{ id: string }>;
}

// PATCH /api/workflow/[id] — update content, done, or position
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;

  let body: { content?: string; done?: boolean; position?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const { content, done, position } = body;

    let query = `UPDATE workflow_items SET "updatedAt" = NOW()`;
    const values: unknown[] = [];

    if (content !== undefined) {
      query += `, content = $${values.length + 1}`;
      values.push(content);
    }

    if (done !== undefined) {
      query += `, done = $${values.length + 1}`;
      values.push(done);
    }

    if (position !== undefined) {
      query += `, position = $${values.length + 1}`;
      values.push(position);
    }

    query += ` WHERE id = $${values.length + 1} RETURNING id, content, type, position, done`;
    values.push(id);

    const result = await prisma.$queryRawUnsafe<
      { id: string; content: string; type: string; position: number; done: boolean }[]
    >(query, ...values);

    if (result.length === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    broadcast("workflow:updated", result[0]);
    return NextResponse.json({ item: result[0] });
  } catch (error) {
    console.error(`PATCH /api/workflow/${id} error:`, error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/workflow/[id] — delete an item
export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params;

  try {
    await prisma.$executeRaw`
      DELETE FROM workflow_items WHERE id = ${id}
    `;

    broadcast("workflow:deleted", { id });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`DELETE /api/workflow/${id} error:`, error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
