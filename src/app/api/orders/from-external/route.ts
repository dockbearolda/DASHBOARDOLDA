import { NextRequest, NextResponse } from "next/server";
import type { OldaCommandeInput as OldaCommandePayload } from "@/types/order";

/**
 * POST /api/orders/from-external
 *
 * Accepte votre format personnalisé et le transforme en OldaCommandePayload
 * pour la création de commande standard.
 */

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
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request),
  });
}

function verifyToken(request: NextRequest): boolean {
  const secret = process.env.DASHBOARD_TOKEN;
  if (!secret) return true; // dev mode

  const auth = request.headers.get("authorization");
  if (auth) {
    const spaceIdx = auth.indexOf(" ");
    const scheme = spaceIdx !== -1 ? auth.slice(0, spaceIdx).toLowerCase() : "";
    const token = spaceIdx !== -1 ? auth.slice(spaceIdx + 1) : "";
    if (scheme === "bearer" && token === secret) return true;
  }

  const xSecret = request.headers.get("x-webhook-secret");
  if (xSecret === secret) return true;

  return false;
}

/**
 * Transforme votre format personnel en OldaCommandePayload
 */
interface ExternalOrderFormat {
  commande?: string;
  qrcode_url?: string;
  nom?: string;
  prenom?: string;
  telephone?: string;
  deadline?: string;
  collection?: string;
  reference?: string;
  taille?: string;
  note?: string;
  fiche?: {
    visuelAvant?: string;
    visuelArriere?: string;
    tailleDTFAr?: string;
    typeProduit?: string;
    couleur?: string;
    designation?: string;
  };
  prt?: {
    type?: string;
    refPrt?: string;
    taillePrt?: string;
    quantite?: string;
    statutPrt?: string;
  };
  prix?: {
    tshirt?: string | number;
    perso?: string | number;
    total?: string | number;
  };
  paiement?: {
    statut?: string;
  };
}


function transformExternalToOlda(data: ExternalOrderFormat): OldaCommandePayload {
  // Convertir statut paiement
  const paymentStatut = data.paiement?.statut?.toUpperCase() === "OUI" ? "OUI" : "NON";

  // Convertir prix total en centimes
  const totalPrice = (() => {
    const val = data.prix?.total;
    if (!val) return 0;
    const num = typeof val === "string" ? parseInt(val, 10) : Number(val);
    return Number.isFinite(num) ? num : 0;
  })();

  // Quantité PRT : convertir string → number
  const prtQuantite = data.prt?.quantite
    ? parseInt(data.prt.quantite, 10) || undefined
    : undefined;

  return {
    commande:   data.commande || `EXT-${Date.now()}`,
    nom:        data.nom || "Client",
    prenom:     data.prenom,
    telephone:  data.telephone,
    collection: data.collection,
    reference:  data.reference,
    taille:     data.taille,
    note:       data.note,
    limit:      data.deadline,   // deadline → limit (nouveau nom)
    fiche: {
      visuelAvant:  data.fiche?.visuelAvant,
      visuelArriere: data.fiche?.visuelArriere,
      tailleDTFAr:  data.fiche?.tailleDTFAr,
      typeProduit:  data.fiche?.typeProduit,
      couleur:      data.fiche?.couleur,
    },
    prt: (data.prt && Object.values(data.prt).some(v => v)) ? {
      refPrt:    data.prt.refPrt,
      taillePrt: data.prt.taillePrt,
      quantite:  prtQuantite,
    } : undefined,
    prix:    { total: totalPrice },
    paiement: { statut: paymentStatut },
  };
}

export async function POST(request: NextRequest) {
  console.log("[FROM-EXTERNAL] Requête reçue");

  const cors = corsHeaders(request);

  if (!verifyToken(request)) {
    console.warn("[FROM-EXTERNAL] Token invalide");
    return NextResponse.json(
      { error: "Unauthorized: invalid webhook secret" },
      { status: 401, headers: cors }
    );
  }

  let externalData: ExternalOrderFormat;
  try {
    externalData = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400, headers: cors }
    );
  }

  // Transformer au format Olda
  const oldaPayload = transformExternalToOlda(externalData);

  // Valider les champs obligatoires
  if (!oldaPayload.commande) {
    return NextResponse.json(
      { error: "Missing required field: commande" },
      { status: 422, headers: cors }
    );
  }

  if (!oldaPayload.nom) {
    return NextResponse.json(
      { error: "Missing required field: nom (ou prenom)" },
      { status: 422, headers: cors }
    );
  }

  if (!oldaPayload.prix?.total || oldaPayload.prix.total <= 0) {
    return NextResponse.json(
      { error: "Missing or invalid field: prix.total (doit être > 0)" },
      { status: 422, headers: cors }
    );
  }

  console.log("[FROM-EXTERNAL] Transformation réussie:", {
    commande: oldaPayload.commande,
    nom: oldaPayload.nom,
    total: oldaPayload.prix.total,
  });

  // Forwarder vers l'endpoint /api/orders standard
  const forwardUrl = new URL(request.url);
  forwardUrl.pathname = "/api/orders";

  const forwardRequest = new Request(forwardUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: request.headers.get("authorization") || "",
      "X-Webhook-Secret": request.headers.get("x-webhook-secret") || "",
    },
    body: JSON.stringify(oldaPayload),
  });

  try {
    const response = await fetch(forwardRequest);
    const data = await response.json();

    return new NextResponse(JSON.stringify(data), {
      status: response.status,
      headers: {
        ...cors,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[FROM-EXTERNAL] Erreur forward:", error);
    return NextResponse.json(
      { error: "Failed to forward request to orders API" },
      { status: 500, headers: cors }
    );
  }
}
