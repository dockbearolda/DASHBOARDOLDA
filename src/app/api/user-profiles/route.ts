import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PEOPLE = ["loic", "charlie", "melina", "amandine"] as const;

// GET /api/user-profiles — return all 4 profiles (create rows if missing)
export async function GET() {
  try {
    for (const userId of PEOPLE) {
      await prisma.$executeRaw`
        INSERT INTO user_profiles (id, "userId", "profilePhotoLink", mood, "cardColor", "createdAt", "updatedAt")
        VALUES (${`profile_${userId}`}, ${userId}, NULL, '', '', NOW(), NOW())
        ON CONFLICT ("userId") DO NOTHING
      `;
    }

    const profiles = await prisma.$queryRaw<
      { userId: string; profilePhotoLink: string | null; mood: string; cardColor: string }[]
    >`
      SELECT "userId", "profilePhotoLink", mood, "cardColor"
      FROM user_profiles
      WHERE "userId" = ANY(ARRAY['loic','charlie','melina','amandine'])
    `;

    return NextResponse.json({ profiles });
  } catch (error) {
    console.error("GET /api/user-profiles error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/user-profiles — upsert mood, photo, or cardColor for a given user
export async function PATCH(req: Request) {
  try {
    const body = await req.json() as {
      userId: string;
      mood?: string;
      profilePhotoLink?: string | null;
      cardColor?: string;
    };

    const { userId, mood, profilePhotoLink, cardColor } = body;

    if (!PEOPLE.includes(userId as typeof PEOPLE[number])) {
      return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
    }

    const result = await prisma.userProfile.upsert({
      where: { userId },
      create: {
        id: `profile_${userId}`,
        userId,
        mood: mood ?? "",
        profilePhotoLink: profilePhotoLink ?? null,
        cardColor: cardColor ?? "",
      },
      update: {
        ...(mood !== undefined          ? { mood }             : {}),
        ...(profilePhotoLink !== undefined ? { profilePhotoLink } : {}),
        ...(cardColor !== undefined     ? { cardColor }        : {}),
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("PATCH /api/user-profiles error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
