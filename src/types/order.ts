export type OrderStatus =
  | "COMMANDE_A_TRAITER"
  | "COMMANDE_EN_ATTENTE"
  | "COMMANDE_A_PREPARER"
  | "MAQUETTE_A_FAIRE"
  | "PRT_A_FAIRE"
  | "EN_ATTENTE_VALIDATION"
  | "EN_COURS_IMPRESSION"
  | "PRESSAGE_A_FAIRE"
  | "CLIENT_A_CONTACTER"
  | "CLIENT_PREVENU"
  | "ARCHIVES";

export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

// ── Article enrichi (correspond à order_items en DB) ─────────────────────────
export interface OrderItem {
  id: string;
  orderId: string;

  // Produit
  famille?: string | null;      // Type produit (T-Shirt, Sweat, etc.)
  couleur?: string | null;
  tailleDTF?: string | null;    // Taille film DTF (A4, A3+5cm…)
  positionLogo?: string | null;
  reference?: string | null;
  taille?: string | null;       // Taille vêtement (S, M, L, XL…)
  collection?: string | null;

  // Visuels
  imageAvant?: string | null;   // URL ou code DTF avant
  imageArriere?: string | null; // URL ou code DTF arrière

  // Client
  noteClient?: string | null;
  positionNote?: string | null;

  // Impression PRT
  prtRef?: string | null;
  prtTaille?: string | null;
  prtQuantite?: number | null;

  // Prix
  prixUnitaire: number;
}

// ── Commande + Client ─────────────────────────────────────────────────────────
export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;         // Nom de famille
  customerFirstName?: string | null; // Prénom
  customerEmail: string;
  customerPhone?: string | null;
  customerAddress?: string | null; // Adresse de livraison
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  total: number;
  subtotal: number;
  shipping: number;
  tax: number;
  currency: string;
  notes?: string | null;
  category?: string | null;
  deadline?: string | Date | null; // Date limite de livraison
  items: OrderItem[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface OrderStats {
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  shippedOrders: number;
  paidOrders: number;
  todayOrders: number;
  todayRevenue: number;
}

// ── Format JSON envoyé par Olda Studio (validation Zod côté API) ──────────────
// Ces types sont utilisés uniquement dans la couche API pour valider l'input.

export interface OldaArticleInput {
  reference?: string;
  taille?: string;
  note?: string;
  collection?: string;
  fiche?: {
    visuelAvant?: string;
    visuelArriere?: string;
    tailleDTFAr?: string;
    typeProduit?: string;
    couleur?: string;
    positionLogo?: string;
  };
  prt?: {
    refPrt?: string;
    taillePrt?: string;
    quantite?: number;
  };
  prix?: {
    tshirt?: number;
    personnalisation?: number;
  };
}

export interface OldaCommandeInput {
  commande: string;
  nom: string;
  prenom?: string;
  telephone?: string;
  adresse?: string;
  limit?: string;
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
    positionLogo?: string;
  };
  prt?: {
    refPrt?: string;
    taillePrt?: string;
    quantite?: number;
  };
  prix?: {
    total?: number;
    tshirt?: number;
    personnalisation?: number;
  };
  paiement?: {
    statut?: "OUI" | "NON" | "PAID" | "PENDING";
  };
  articles?: OldaArticleInput[];
}

// ── Rétrocompatibilité — utilisé dans TshirtOrderCard pour le rendu ───────────
// Conservé pour la couche UI uniquement (conversion depuis order.items).

export interface OldaArticle {
  reference?: string;
  taille?: string;
  note?: string;
  collection?: string;
  fiche?: {
    visuelAvant?: string;
    visuelArriere?: string;
    tailleDTFAr?: string;
    typeProduit?: string;
    couleur?: string;
    positionLogo?: string;
  };
  prt?: {
    refPrt?: string;
    taillePrt?: string;
    quantite?: number;
  };
  prix?: {
    tshirt?: number;
    personnalisation?: number;
  };
}

/** @deprecated Utiliser Order.items directement — conservé pour migration */
export type OldaExtraData = Record<string, unknown>;

// ── Workflow Items ────────────────────────────────────────────────────────────

export type WorkflowListType = "ACHAT" | "STANDARD" | "ATELIER" | "DTF";

export interface WorkflowItem {
  id: string;
  listType: WorkflowListType;
  title: string;
  position: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}
