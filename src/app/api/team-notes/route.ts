import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const TEAM_PEOPLE = ["loic", "melina", "amandine", "renaud"] as const;

// GET /api/team-notes — return all 4 team notes (create rows if they don't exist)
export async function GET() {
  try {
    for (const person of TEAM_PEOPLE) {
      await prisma.$executeRaw`
        INSERT INTO team_notes (id, person, note, mood, "updatedBy", "updatedAt")
        VALUES (${`team_${person}`}, ${person}, '', '', '', NOW())
        ON CONFLICT (person) DO NOTHING
      `;
    }

    const notes = await prisma.$queryRaw<
      { person: string; note: string; mood: string; updatedBy: string; updatedAt: Date }[]
    >`
      SELECT person, note, mood, "updatedBy", "updatedAt"
      FROM team_notes
      WHERE person = ANY(ARRAY['loic','melina','amandine','renaud'])
      ORDER BY person
    `;

    return NextResponse.json({ notes });
  } catch (error) {
    console.error("GET /api/team-notes error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/team-notes — upsert note or mood for a given person
export async function PATCH(req: Request) {
  try {
    const body = await req.json() as {
      person: string;
      note?: string;
      mood?: string;
      updatedBy?: string;
    };

    const { person, note, mood, updatedBy } = body;

    if (!TEAM_PEOPLE.includes(person as typeof TEAM_PEOPLE[number])) {
      return NextResponse.json({ error: "Invalid person" }, { status: 400 });
    }

    const result = await prisma.teamNote.upsert({
      where: { person },
      create: {
        id: `team_${person}`,
        person,
        note: note ?? "",
        mood: mood ?? "",
        updatedBy: updatedBy ?? "",
      },
      update: {
        ...(note !== undefined ? { note } : {}),
        ...(mood !== undefined ? { mood } : {}),
        ...(updatedBy !== undefined ? { updatedBy } : {}),
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("PATCH /api/team-notes error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
