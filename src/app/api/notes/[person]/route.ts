import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { noteEvents } from "@/lib/events";

const VALID_PEOPLE = ["loic", "charlie", "melina", "amandine"];

interface Params {
  params: Promise<{ person: string }>;
}

// PATCH /api/notes/[person] — upsert note content and/or todos
export async function PATCH(request: NextRequest, { params }: Params) {
  const { person } = await params;

  if (!VALID_PEOPLE.includes(person)) {
    return NextResponse.json({ error: "Invalid person" }, { status: 422 });
  }

  let body: { content?: string; todos?: { id: string; text: string; done: boolean }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const content = body.content ?? null;
  const todos = body.todos !== undefined ? JSON.stringify(body.todos) : null;

  try {
    await prisma.$executeRaw`
      INSERT INTO person_notes (id, person, content, todos, "updatedAt")
      VALUES (
        ${`note_${person}`}, ${person},
        ${content ?? ""},
        ${todos ?? "[]"}::jsonb,
        NOW()
      )
      ON CONFLICT (person) DO UPDATE SET
        content   = CASE WHEN ${content}::text IS NOT NULL THEN ${content}::text ELSE person_notes.content END,
        todos     = CASE WHEN ${todos}::jsonb IS NOT NULL  THEN ${todos}::jsonb  ELSE person_notes.todos  END,
        "updatedAt" = NOW()
    `;

    const rows = await prisma.$queryRaw<
      { person: string; content: string; todos: unknown }[]
    >`
      SELECT person, content, todos FROM person_notes WHERE person = ${person}
    `;

    // Broadcast la mise à jour à tous les clients SSE connectés
    noteEvents.emit("note-changed", rows[0]);

    return NextResponse.json({ note: rows[0] });
  } catch (error) {
    console.error(`PATCH /api/notes/${person} error:`, error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
