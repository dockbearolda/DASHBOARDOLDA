import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

const VALID_USERS = ["loic", "charlie", "melina", "amandine", "renaud"];

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

// Récupère l'utilisateur connecté depuis le cookie de session
function getUserFromCookie(cookieValue: string | undefined): string | null {
  if (!cookieValue) return null;
  const colonIdx = cookieValue.indexOf(":");
  if (colonIdx === -1) return null;
  return cookieValue.slice(0, colonIdx) || null;
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session     = cookieStore.get("olda-session")?.value;
    const user        = getUserFromCookie(session);

    if (!user || !VALID_USERS.includes(user)) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { currentPassword, newPassword } = (await req.json()) as {
      currentPassword: string;
      newPassword:     string;
    };

    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: "Paramètres invalides (min. 6 caractères)" }, { status: 400 });
    }

    // Vérifier le mot de passe actuel
    const profile        = await prisma.userProfile.findUnique({ where: { userId: user }, select: { passwordHash: true } });
    const defaultPassword = process.env.AUTH_DEFAULT_PASSWORD ?? "olda97150";
    const currentValid    = profile?.passwordHash
      ? profile.passwordHash === sha256(currentPassword)
      : currentPassword === defaultPassword;

    if (!currentValid) {
      return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 401 });
    }

    // Sauvegarder le nouveau mot de passe haché
    await prisma.userProfile.upsert({
      where:  { userId: user },
      create: { userId: user, passwordHash: sha256(newPassword) },
      update: { passwordHash: sha256(newPassword) },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
