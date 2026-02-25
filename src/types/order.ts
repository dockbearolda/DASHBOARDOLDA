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

export interface OrderItem {
  id: string;
  orderId: string;
  name: string;
  sku?: string | null;
  quantity: number;
  price: number;
  imageUrl?: string | null;
}

export interface Address {
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  state?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  total: number;
  subtotal: number;
  shipping: number;
  tax: number;
  currency: string;
  notes?: string | null;
  category?: string | null;
  /** Peut contenir une Address OU des OldaExtraData selon l'origine de la commande */
  shippingAddress?: Record<string, unknown> | null;
  billingAddress?: Address | null;
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

// ── Nouveau format JSON envoyé par Olda Studio ────────────────────────────────

/** Champs extra stockés dans shippingAddress (JSONB) pour les commandes Olda Studio */
export interface OldaExtraData {
  // ── Identité commande ──
  commande?: string;           // Order ID unique
  nom?: string;                // Full name (last name or full)
  prenom?: string;             // First name
  telephone?: string;

  // ── Deadline → limit (renamed) ──
  limit?: string;              // Date limite (ISO 8601 ou texte lisible)

  // ── Références & détails ──
  collection?: string;
  reference?: string;          // Référence produit (ex: "PACK-NOIR-L")
  taille?: string;             // Taille générale
  note?: string;               // Notes supplémentaires

  // ── Fiche (visuel + spécifications) ──
  fiche?: {
    visuelAvant?: string;      // Image ou code DTF avant
    visuelArriere?: string;    // Image ou code DTF arrière
    tailleDTFAr?: string;      // Taille DTF arrière (ex: "A4", "A3 +5cm")
    typeProduit?: string;      // Type de produit (T-shirt, etc.)
    couleur?: string;          // Couleur
  };

  // ── Impression (PRT) ──
  prt?: {
    refPrt?: string;           // Référence impression
    taillePrt?: string;        // Taille impression
    quantite?: number;         // Quantité
  };

  // ── Paiement ──
  paiement?: {
    statut?: "OUI" | "NON" | "PAID" | "PENDING";  // OUI = PAID, NON = PENDING
  };

  // ── Prix (en centimes) ──
  prix?: {
    total?: number;            // Montant total en centimes
    tshirt?: number;           // Prix T-shirt nu en centimes
    personnalisation?: number; // Prix personnalisation DTF/Pressage en centimes
  };

  // ── Marqueur d'origine ──
  _source?: "olda_studio";     // Ne pas modifier
}

/** Payload JSON envoyé directement par Olda Studio vers POST /api/orders */
export interface OldaCommandePayload {
  commande: string;          // ID unique de la commande (= orderNumber)
  nom: string;               // Prénom Nom du client
  prenom?: string;           // First name (extracted or provided)
  telephone?: string;
  collection?: string;
  reference?: string;        // Référence produit
  taille?: string;
  note?: string;
  limit?: string;            // Date limite (renamed from deadline)
  fiche?: {
    visuelAvant?: string;
    visuelArriere?: string;
    tailleDTFAr?: string;    // Taille DTF arrière
    typeProduit?: string;
    couleur?: string;
  };
  prt?: {
    refPrt?: string;
    taillePrt?: string;
    quantite?: number;
  };
  prix?: {
    total?: number;          // En centimes
    tshirt?: number;         // Prix T-shirt nu en centimes
    personnalisation?: number; // Prix personnalisation en centimes
  };
  paiement?: {
    statut?: "OUI" | "NON";  // OUI = PAID, NON = PENDING
  };
}

export interface WebhookOrderPayload {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  total: number;
  subtotal: number;
  shipping?: number;
  tax?: number;
  currency?: string;
  notes?: string;
  category?: string;
  shippingAddress?: Address;
  billingAddress?: Address;
  items: {
    name: string;
    sku?: string;
    quantity: number;
    price: number;
    imageUrl?: string;
  }[];
}

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
