import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// Retourne l'utilisateur connecté depuis le cookie de session
// (le middleware a déjà validé le HMAC — on se contente de décoder l'username)
export async function GET() {
  const cookieStore = await cookies();
  const token       = cookieStore.get("olda-session")?.value;
  if (!token) return NextResponse.json({ user: null });
  const user = token.split(":")[0] || null;
  return NextResponse.json({ user });
}
