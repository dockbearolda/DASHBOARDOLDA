import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

const VALID_USERS = ["loic", "charlie", "melina", "amandine", "renaud"];

// ── SHA-256 hex ───────────────────────────────────────────────────────────────
function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

// ── HMAC (Web Crypto) pour le token de session ────────────────────────────────
async function hmac(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export async function POST(req: NextRequest) {
  try {
    const { username, password } = (await req.json()) as {
      username: string;
      password: string;
    };

    const user = username?.toLowerCase().trim();

    // Vérifier que l'utilisateur est un membre de l'équipe
    if (!user || !VALID_USERS.includes(user) || !password) {
      return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
    }

    // Récupérer le profil DB pour voir s'il a un mot de passe perso
    const profile = await prisma.userProfile.findUnique({
      where:  { userId: user },
      select: { passwordHash: true },
    });

    // Mot de passe attendu :
    //   1. Si profil avec passwordHash → comparer avec SHA-256(input)
    //   2. Sinon → comparer avec le mot de passe par défaut en clair (env var)
    const defaultPassword = process.env.AUTH_DEFAULT_PASSWORD ?? "olda97150";

    const isValid = profile?.passwordHash
      ? profile.passwordHash === sha256(password)
      : password === defaultPassword;

    if (!isValid) {
      return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
    }

    // Générer le token de session (HMAC signé)
    const secret = process.env.AUTH_SECRET ?? "change-this-secret-in-production";
    const token  = `${user}:${await hmac(user, secret)}`;

    const res = NextResponse.json({ ok: true, user });
    res.cookies.set("olda-session", token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge:   60 * 60 * 12, // 12 heures
      path:     "/",
    });
    return res;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
