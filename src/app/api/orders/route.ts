import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { orderEvents } from "@/lib/events";

type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;

// ── CORS ──────────────────────────────────────────────────────────────────────

const ALLOWED_ORIGIN = "https://oldastudio.up.railway.app";

function corsHeaders(request?: NextRequest): Record<string, string> {
  const origin = request?.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin":
      origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Webhook-Secret",
    "Access-Control-Max-Age": "86400",
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

// ── Auth ──────────────────────────────────────────────────────────────────────

function verifyToken(request: NextRequest): boolean {
  const secret = process.env.DASHBOARD_TOKEN;
  if (!secret) return true;

  const auth = request.headers.get("authorization");
  if (auth) {
    const idx = auth.indexOf(" ");
    if (idx !== -1 && auth.slice(0, idx).toLowerCase() === "bearer" && auth.slice(idx + 1) === secret)
      return true;
  }
  return request.headers.get("x-webhook-secret") === secret;
}

// ── Zod schemas ───────────────────────────────────────────────────────────────

const ArticleSchema = z.object({
  reference:  z.string().optional(),
  taille:     z.string().optional(),
  note:       z.string().optional(),
  collection: z.string().optional(),
  fiche: z.object({
    visuelAvant:  z.string().optional(),
    visuelArriere: z.string().optional(),
    tailleDTFAr:  z.string().optional(),
    typeProduit:  z.string().optional(),
    couleur:      z.string().optional(),
    positionLogo: z.string().optional(),
  }).optional(),
  prt: z.object({
    refPrt:    z.string().optional(),
    taillePrt: z.string().optional(),
    quantite:  z.union([z.number(), z.string().transform(Number)]).optional(),
  }).optional(),
  prix: z.object({
    tshirt:          z.number().optional(),
    personnalisation: z.number().optional(),
  }).optional(),
});

const OldaCommandeSchema = z.object({
  commande:   z.string().min(1),
  nom:        z.string().min(1),
  prenom:     z.string().optional(),
  telephone:  z.string().optional(),
  limit:      z.string().optional(),
  collection: z.string().optional(),
  reference:  z.string().optional(),
  taille:     z.string().optional(),
  note:       z.string().optional(),
  fiche: z.object({
    visuelAvant:  z.string().optional(),
    visuelArriere: z.string().optional(),
    tailleDTFAr:  z.string().optional(),
    typeProduit:  z.string().optional(),
    couleur:      z.string().optional(),
    positionLogo: z.string().optional(),
  }).optional(),
  prt: z.object({
    refPrt:    z.string().optional(),
    taillePrt: z.string().optional(),
    quantite:  z.union([z.number(), z.string().transform(Number)]).optional(),
  }).optional(),
  prix: z.object({
    total:            z.number().optional(),
    tshirt:           z.number().optional(),
    personnalisation: z.number().optional(),
  }).optional(),
  paiement: z.object({
    statut: z.enum(["OUI", "NON", "PAID", "PENDING"]).optional(),
  }).optional(),
  articles: z.array(ArticleSchema).optional(),
});

type OldaCommande = z.infer<typeof OldaCommandeSchema>;
type Article = z.infer<typeof ArticleSchema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function calcItemPrice(article: Article): number {
  const tshirt = safeNum(article.prix?.tshirt);
  const perso  = safeNum(article.prix?.personnalisation);
  return tshirt + perso;
}

/** Résout les articles : si aucun articles[], crée un article depuis les champs racine. */
function resolveArticles(o: OldaCommande): Article[] {
  if (o.articles && o.articles.length > 0) return o.articles;
  // Format mono-article (champs au niveau racine)
  const hasData = o.fiche || o.reference || o.taille || o.prt;
  if (!hasData) return [{ reference: o.commande }];
  return [{
    reference:  o.reference,
    taille:     o.taille,
    note:       o.note,
    collection: o.collection,
    fiche:      o.fiche,
    prt:        o.prt,
    prix:       o.prix ? { tshirt: o.prix.tshirt, personnalisation: o.prix.personnalisation } : undefined,
  }];
}

// ── GET /api/orders ───────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: { items: true },
    });

    const mapped = (orders as unknown as OrderWithItems[]).map((o) => ({
      ...o,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
      deadline:  o.deadline?.toISOString() ?? null,
    }));

    return NextResponse.json({ orders: mapped }, { headers: corsHeaders(request) });
  } catch (error) {
    console.error("GET /api/orders error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}

// ── POST /api/orders — réception webhook Olda Studio ─────────────────────────

export async function POST(request: NextRequest) {
  const cors = corsHeaders(request);

  if (!verifyToken(request)) {
    return NextResponse.json(
      { error: "Unauthorized: invalid webhook secret" },
      { status: 401, headers: cors }
    );
  }

  let raw: unknown;
  try { raw = await request.json(); }
  catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400, headers: cors });
  }

  // ── Validation Zod ────────────────────────────────────────────────────────
  const result = OldaCommandeSchema.safeParse(raw);
  if (!result.success) {
    console.warn("[OLDA] Payload invalide :", result.error.flatten());
    return NextResponse.json(
      { error: "Payload invalide", details: result.error.flatten() },
      { status: 422, headers: cors }
    );
  }

  const o       = result.data;
  const isPaid  = o.paiement?.statut === "OUI" || o.paiement?.statut === "PAID";
  const totalAmt = safeNum(o.prix?.total);
  const articles = resolveArticles(o);

  // ── Vérification doublon ──────────────────────────────────────────────────
  const existing = await prisma.order.findUnique({
    where: { orderNumber: o.commande },
    select: { id: true },
  });

  if (existing) {
    // Mise à jour des champs mutables uniquement
    await prisma.order.update({
      where: { id: existing.id },
      data: {
        paymentStatus: isPaid ? "PAID" : "PENDING",
        notes: o.note ?? undefined,
        updatedAt: new Date(),
      },
    });
    console.log(`[OLDA] Commande mise à jour : #${o.commande}`);

    const updated = await prisma.order.findUnique({
      where: { id: existing.id },
      include: { items: true },
    });
    const updatedOrder = {
      ...updated,
      createdAt: (updated!.createdAt as Date).toISOString(),
      updatedAt: (updated!.updatedAt as Date).toISOString(),
      deadline:  updated!.deadline?.toISOString() ?? null,
    };
    return NextResponse.json({ success: true, order: updatedOrder }, { status: 200, headers: cors });
  }

  // ── Création avec transaction Prisma ──────────────────────────────────────
  // Si un article échoue, toute la commande est annulée.
  try {
    const order = await prisma.order.create({
      data: {
        orderNumber:       o.commande,
        customerName:      o.nom,
        customerFirstName: o.prenom ?? null,
        customerEmail:     "olda@studio",
        customerPhone:     o.telephone ?? null,
        deadline:          o.limit ? new Date(o.limit) : null,
        status:            "COMMANDE_A_TRAITER",
        paymentStatus:     isPaid ? "PAID" : "PENDING",
        total:             totalAmt,
        subtotal:          totalAmt,
        category:          "t-shirt",
        notes:             o.note ?? null,
        items: {
          create: articles.map((article) => ({
            famille:      article.fiche?.typeProduit   ?? null,
            couleur:      article.fiche?.couleur       ?? null,
            tailleDTF:    article.fiche?.tailleDTFAr   ?? null,
            positionLogo: article.fiche?.positionLogo  ?? null,
            reference:    article.reference            ?? null,
            taille:       article.taille               ?? null,
            collection:   article.collection           ?? null,
            imageAvant:   article.fiche?.visuelAvant   ?? null,
            imageArriere: article.fiche?.visuelArriere ?? null,
            noteClient:   article.note                 ?? null,
            prtRef:       article.prt?.refPrt          ?? null,
            prtTaille:    article.prt?.taillePrt       ?? null,
            prtQuantite:  article.prt?.quantite != null ? Number(article.prt.quantite) : null,
            prixUnitaire: calcItemPrice(article),
          })),
        },
      },
      include: { items: true },
    });

    console.log(`[OLDA] Nouvelle commande créée : #${o.commande} (${articles.length} article(s))`);

    const formattedOrder = {
      ...order,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      deadline:  order.deadline?.toISOString() ?? null,
    };
    orderEvents.emit("new-order", formattedOrder);

    return NextResponse.json(
      { success: true, order: formattedOrder },
      { status: 201, headers: cors }
    );
  } catch (error) {
    console.error("POST /api/orders error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to create order", detail: message },
      { status: 500, headers: cors }
    );
  }
}
