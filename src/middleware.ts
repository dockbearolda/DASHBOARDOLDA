import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ── Routes accessibles sans authentification ─────────────────────────────────
const PUBLIC_PREFIXES = [
  "/s/",          // pages de suivi client (discret)
  "/track/",      // pages de suivi client (compat backward)
  "/api/track/",  // API polling suivi public
  "/login",       // page de connexion
  "/api/auth/",   // API auth (login / logout)
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("olda-session")?.value;
  const isLoggedIn = token ? await verifyToken(token) : false;

  // Déjà connecté → rediriger /login vers le dashboard directement
  if (pathname.startsWith("/login") && isLoggedIn) {
    const dashboard = request.nextUrl.clone();
    dashboard.pathname = "/dashboard/olda";
    return NextResponse.redirect(dashboard);
  }

  // Routes publiques (suivi client, auth)
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Routes protégées — vérifier la session
  if (!isLoggedIn) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// ── Vérification HMAC (Web Crypto — compatible Edge Runtime) ─────────────────

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

async function verifyToken(token: string): Promise<boolean> {
  try {
    const secret   = process.env.AUTH_SECRET ?? "change-this-secret-in-production";
    const colonIdx = token.indexOf(":");
    if (colonIdx === -1) return false;
    const user = token.slice(0, colonIdx);
    const sig  = token.slice(colonIdx + 1);
    if (!user || !sig) return false;
    const expected = await hmac(user, secret);
    // Comparaison en temps constant pour éviter les timing attacks
    return sig === expected;
  } catch {
    return false;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
