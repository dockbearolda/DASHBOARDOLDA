import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/prt-requests/[id] — update a PRT request
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { clientName, dimensions, design, color, quantity, done, position } = body;

    const updateData: Record<string, unknown> = {};
    if (clientName !== undefined) updateData.clientName = clientName;
    if (dimensions !== undefined) updateData.dimensions = dimensions;
    if (design !== undefined) updateData.design = design;
    if (color !== undefined) updateData.color = color;
    if (quantity !== undefined) updateData.quantity = quantity;
    if (done !== undefined) updateData.done = done;
    if (position !== undefined) updateData.position = position;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const item = await prisma.pRTRequest.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ item });
  } catch (error) {
    console.error(`PATCH /api/prt-requests/[id] error:`, error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/prt-requests/[id] — delete a PRT request
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.pRTRequest.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`DELETE /api/prt-requests/[id] error:`, error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
