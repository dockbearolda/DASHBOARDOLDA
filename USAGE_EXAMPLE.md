# 🎯 OrderCard — Exemples d'utilisation

## Basic Usage

```tsx
import { OrderCard } from "@/components/olda/order-card";
import type { OldaExtraData } from "@/types/order";

export default function SimpleExample() {
  const data: OldaExtraData = {
    commande: "CMD-2026-001",
    nom: "Dupont",
    prenom: "Jean",
    telephone: "+33 6 12 34 56 78",
    limit: "2026-02-28",
    reference: "REF-NOIR-L",
    prix: {
      total: 2500, // 25,00 €
    },
  };

  return <OrderCard data={data} orderId="cmd-001" />;
}
```

## Exemple Complet (STUDIOOLDA)

```tsx
import { OrderCard } from "@/components/olda/order-card";
import type { OldaExtraData } from "@/types/order";

const studentData: OldaExtraData = {
  // ── Identité ──
  commande: "CMD-2026-042",
  nom: "Martin",
  prenom: "Sarah",
  telephone: "+33 7 45 23 67 89",

  // ── Dates ──
  limit: "2026-02-27", // Demain

  // ── Références ──
  collection: "Printemps 2026",
  reference: "PACK-BLANC-M",
  taille: "Medium",
  note: "Client VIP — priorité haute!",

  // ── Visuels ──
  fiche: {
    visuelAvant: "DTF-2026-MARTIN-AV",
    visuelArriere: "DTF-2026-MARTIN-AR",
    tailleDTFAr: "A3",
    typeProduit: "T-shirt",
    couleur: "Blanc",
  },

  // ── Impression ──
  prt: {
    refPrt: "PRT-2026-042",
    taillePrt: "12cm×15cm",
    quantite: 100,
  },

  // ── Paiement ──
  paiement: {
    statut: "PAID", // Payé
  },

  // ── Prix ──
  prix: {
    total: 15000, // 150,00 €
  },
};

export default function StudentOrderCard() {
  return <OrderCard data={studentData} orderId="cmd-042" />;
}
```

## Exemple Minimal (Valeurs vides cachées)

```tsx
const minimalData: OldaExtraData = {
  commande: "CMD-SIMPLE",
  nom: "Durand",
  prenom: "Marc",
  prix: {
    total: 1000, // 10,00 €
  },
  // Autres champs omis → ne s'affichent pas
};

<OrderCard data={minimalData} orderId="simple" />
```

**Rendu:** Juste le header avec nom + prix (téléphone, limit, images, etc. cachés)

## Intégration dans `olda-board.tsx`

### Before (TshirtOrderCard)

```tsx
import { TshirtOrderCard } from "./tshirt-order-card";

export function OldaBoard() {
  const orders = useOrders();

  return (
    <div className="grid gap-4">
      {orders.map((order) => (
        <TshirtOrderCard
          key={order.id}
          order={order}
          isNew={newOrderIds?.has(order.id)}
        />
      ))}
    </div>
  );
}
```

### After (OrderCard)

```tsx
import { OrderCard } from "./order-card";
import type { OldaExtraData } from "@/types/order";

export function OldaBoard() {
  const orders = useOrders();

  return (
    <div className="grid gap-4">
      {orders.map((order) => {
        // Extraire les données Olda Studio
        const extraData = order.shippingAddress as OldaExtraData || {};

        return (
          <OrderCard
            key={order.id}
            data={extraData}
            orderId={order.id}
          />
        );
      })}
    </div>
  );
}
```

## Mode Print (Renaud - Atelier)

### Déclencher l'impression

```tsx
const printOrder = (orderId: string) => {
  // Le mode print se déclenche automatiquement avec Cmd+P (Mac) ou Ctrl+P (Windows)
  // ou programmatiquement:
  window.print();
};
```

### Résultat

```
┌──────────────────────┐
│   SARAH MARTIN       │
│  +33 7 45 23 67 89   │
│                      │
│ [IMAGE AVANT]        │
│ DTF-2026-MARTIN-AV   │
│                      │
│ [IMAGE ARRIÈRE]      │
│ DTF-2026-MARTIN-AR   │
│                      │
│     150,00 €         │
└──────────────────────┘
```

Format A4 (21×29.7cm), images lisibles à l'atelier ✓

## États du composant

### État 1: Bulle fermée (par défaut)

```
┌────────────────────────────────┐
│ [QR] SARAH MARTIN             │
│      +33 7 45 23 67 89         │
│      Limit: Demain             │
│      Blanc · M · T-shirt      │
│                       150€     │
│                    ▼ (chevron) │
└────────────────────────────────┘
```

### État 2: Accordéon ouvert (au clic sur chevron)

```
État 1 +
├─ Printemps 2026 (collection)
├─ PACK-BLANC-M (reference)
├─ Medium (taille)
├─ Client VIP — priorité haute! (note)
└─ [PRT Block]
   ├─ Ref: PRT-2026-042
   ├─ Taille: 12cm×15cm
   └─ Qté: 100
```

## Cas d'usage spécifiques

### 1. Commande avec images uploadées localement

```tsx
const withLocalImages: OldaExtraData = {
  commande: "CMD-LOCAL",
  nom: "Test",
  prenom: "User",
  // fiche.visuelAvant/Arriere vides
  // → Images chargées via localStorage après upload
  prix: { total: 5000 },
};

// Après upload utilisateur via UI (si implémenté):
// → Les images apparaissent côte à côte en 96×96px
```

### 2. Commande avec codes DTF uniquement

```tsx
const dtfOnlyData: OldaExtraData = {
  commande: "CMD-DTF",
  nom: "Atelier",
  prenom: "Renaud",
  fiche: {
    visuelAvant: "DTF-2026-ATELIER-AV", // Code DTF (pas URL)
    visuelArriere: "DTF-2026-ATELIER-AR", // Code DTF
    tailleDTFAr: "A4+",
    typeProduit: "T-shirt",
    couleur: "Noir",
  },
  prix: { total: 8000 },
};

// Rendu:
// [DTF-2026-ATELIER-AV] [DTF-2026-ATELIER-AR]
// (affichés en monospace, bg-gray-50)
```

### 3. Commande en retard

```tsx
const overdueData: OldaExtraData = {
  commande: "CMD-URGENT",
  nom: "Client",
  prenom: "Urgent",
  limit: "2026-02-20", // Hier
  note: "⚠️ EN RETARD!",
  prix: { total: 3000 },
};

// Le label "limit" affiche:
// "⚠️ En retard (4j)"
// Texte rouge pour alerter
```

### 4. Commande sans détails (juste client + prix)

```tsx
const bareMinimum: OldaExtraData = {
  nom: "Minimal",
  prenom: "Test",
  prix: { total: 1000 },
};

// Rendu: Juste header avec nom + prix
// Tous autres éléments cachés (règle: valeurs vides = pas d'affichage)
```

## Props optionnels (Futur)

```tsx
// Actuellement non implémentés, mais réservés pour:

interface OrderCardProps {
  data: OldaExtraData;
  orderId?: string;

  // À ajouter:
  onDelete?: () => void;  // Bouton supprimer
  onEdit?: () => void;    // Mode édition
  isNew?: boolean;        // Animation fade-up
  // ...
}
```

## Validation des données

Pour éviter les erreurs, valider avec zod (exemple futur):

```tsx
import { z } from "zod";

const OldaExtraDataSchema = z.object({
  commande: z.string().optional(),
  nom: z.string().optional(),
  prenom: z.string().optional(),
  telephone: z.string().optional(),
  limit: z.string().optional(),
  collection: z.string().optional(),
  reference: z.string().optional(),
  taille: z.string().optional(),
  note: z.string().optional(),
  fiche: z.object({
    visuelAvant: z.string().optional(),
    visuelArriere: z.string().optional(),
    tailleDTFAr: z.string().optional(),
    typeProduit: z.string().optional(),
    couleur: z.string().optional(),
  }).optional(),
  prt: z.object({
    refPrt: z.string().optional(),
    taillePrt: z.string().optional(),
    quantite: z.number().optional(),
  }).optional(),
  prix: z.object({
    total: z.number().optional(),
  }).optional(),
  paiement: z.object({
    statut: z.enum(["OUI", "NON", "PAID", "PENDING"]).optional(),
  }).optional(),
  _source: z.literal("olda_studio").optional(),
});

// Utilisation:
const validData = OldaExtraDataSchema.parse(rawData);
```

## 🔧 Dépannage

### Problème: Images ne s'affichent pas
- Vérifier: `data.fiche?.visuelAvant` et `data.fiche?.visuelArriere`
- Checker localStorage: `localStorage.getItem(`olda-images-${orderId}`)`

### Problème: Accordéon chevron ne s'affiche pas
- Vérifier: Au moins une des valeurs (collection, reference, taille, note, prt.*) doit être non-vide

### Problème: Print vide
- Vérifier: Classe `.olda-card-print` sur le rendu print
- Tester: Cmd+P / Ctrl+P

### Problème: Valeur non formatée
- Images DTF: Vérifier que code commence pas par "http" ou "data:"
- Prix: Vérifier que `prix.total` est en centimes (÷ 100 automatique)

---

**Besoin de plus d'exemples?** Consulter `IMPLEMENTATION_GUIDE.md`
