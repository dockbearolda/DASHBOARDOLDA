import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/socket-server";

// PATCH /api/planning/[id] — update a planning item
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      priority,
      clientName,
      clientId,
      quantity,
      designation,
      note,
      unitPrice,
      deadline,
      status,
      responsible,
      color,
      position,
    } = body;

    const updateData: Record<string, unknown> = {};
    if (priority !== undefined) updateData.priority = priority;
    if (clientName !== undefined) updateData.clientName = clientName;
    if (clientId !== undefined) updateData.clientId = clientId;
    if (quantity !== undefined) updateData.quantity = quantity;
    if (designation !== undefined) updateData.designation = designation;
    if (note !== undefined) updateData.note = note;
    if (unitPrice !== undefined) updateData.unitPrice = unitPrice;
    if (deadline !== undefined) updateData.deadline = deadline ? new Date(deadline) : null;
    if (status !== undefined) updateData.status = status;
    if (responsible !== undefined) updateData.responsible = responsible;
    if (color !== undefined) updateData.color = color;
    if (position !== undefined) updateData.position = position;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const item = await prisma.planningItem.update({
      where: { id },
      data: updateData,
    });

    broadcast("planning:updated", item);
    return NextResponse.json({ item });
  } catch (error) {
    console.error(`PATCH /api/planning/[id] error:`, error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/planning/[id] — delete a planning item
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.planningItem.delete({
      where: { id },
    });

    broadcast("planning:deleted", { id });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`DELETE /api/planning/[id] error:`, error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
