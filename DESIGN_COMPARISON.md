# 🎨 Design Comparison — Old vs New

## Layout Overview

### OLD: TshirtOrderCard

```
┌─────────────────────────────────────────────┐
│  [QR]  Date · Bon de Commande              │ L1
│  64×64 Ref : PACK-NOIR-L · 🟢               │ L2
│        Client Name                          │ L3
│        Tel : +33 6 12 34 56 78              │ L4
│        Deadline : ⚠️ In retard (2j)         │ L5
│        DTF AR : A4                          │ L6
├─────────────────────────────────────────────┤
│ Tâches [2/5] ▾                             │
│ ├─ ✓ [Jean] Task 1                        │
│ ├─ ○ [Marie] Task 2                       │
│ └─ ○ + Ajouter une tâche…                │
├─────────────────────────────────────────────┤
│ 3 art.                            25,00 €  │
└─────────────────────────────────────────────┘
```

**Caractéristiques:**
- Bulle 24px
- 6 lignes d'info + QR
- Section "Tâches" intégrée
- Affichage du total quantité
- Labels explicites ("Tel :", "Deadline :")

---

### NEW: OrderCard

```
┌─────────────────────────────────────────────┐
│ [QR] PRENOM NOM                            │
│      +33 6 12 34 56 78                     │
│      Limit: Dans 3j · 15 jan               │
│      Noir · XL · T-shirt                   │
│                               15,00 €      │
│              ▼ (chevron — si détails)      │
└─────────────────────────────────────────────┘

[Visuels côte à côte si accordéon ouvert]
┌─────────────────────────────────────────────┐
│                                             │
│  [96×96]   [96×96]                         │
│  Avant     Arrière                         │
│                                             │
└─────────────────────────────────────────────┘

[Accordéon ouvert — au clic chevron]
┌─────────────────────────────────────────────┐
│ Printemps 2026                              │
│ PACK-NOIR-L                                 │
│ Large                                       │
│ Client VIP — priorité!                      │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ Ref: PRT-2026-01                        │ │
│ │ Taille: XL                              │ │
│ │ Qté: 50                                 │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

**Caractéristiques:**
- Bulle 18px (Apple Premium)
- Header compact (QR + identity)
- Visuels Avant/Arrière côte à côte
- Accordéon pour détails (collection, reference, taille, note, prt)
- Pas de section "Tâches" (prévue pour futur)
- Aucun label explicite

---

## Différences principales

| Aspect | Ancien | Nouveau |
|--------|--------|---------|
| **Coins** | 24px | 18px (Apple) |
| **Bordure** | `border-gray-200/80` | `border-[#E5E5E5]` |
| **Layout** | 6 lignes verticales | Bulle compacte + accordéon |
| **Tâches** | Intégrées | Supprimées (refactoring futur) |
| **Visuels** | Non inclus | Avant/Arrière côte à côte (96×96) |
| **Labels** | "Tel :", "Deadline :" | Aucun label ("XL" pas "Taille: XL") |
| **Accordéon** | Pas d'accordéon | Chevron pour détails |
| **Print** | Modal avec impression | @media print intégré |
| **État** | Pas d'animation | Chevron rotation smooth |

---

## Contenu détaillé

### Ancien: 6 lignes d'info

```
L1 — Date · Label
L2 — Ref + Pastille paiement
L3 — Nom client
L4 — Tel
L5 — Deadline
L6 — DTF Arrière
```

### Nouveau: Bulle fermée

```
Header (QR + Identity)
├─ [QR Code 64×64]
├─ PRENOM NOM (bold, UPPERCASE)
├─ Téléphone (gris)
└─ Limit: "Dans 3j · 15 jan" (gris)

Visuels (si présents)
├─ [96×96 Avant]
└─ [96×96 Arrière]

Infos discrètes
└─ "Noir · XL · T-shirt" (12px gris)

Footer
├─ Prix: "15,00 €" (18px bold, droite)
└─ Chevron: "▼" (centré, si détails)
```

### Nouveau: Accordéon déployé

```
Collection
Reference
Taille
Note
PRT Block (refPrt, taillePrt, quantite)
```

---

## Esthétique Apple Premium

### Couleurs

```
Fond:          #FFFFFF (white)
Bordure:       #E5E5E5 (très léger gris)
Texte primaire: #1D1D1F (quasi-noir)
Texte gris:    #666666 (#666 ou gray-500)
Texte léger:   #A0A0A3 (gray-400)
Ombre:         0 1px 8px rgba(0,0,0,0.05)
Ombre hover:   0 6px 24px rgba(0,0,0,0.09)
```

### Typo

```
Police: -apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, sans-serif

Tailles:
├─ Header (Prenom Nom): 16px, font-bold, UPPERCASE
├─ Infos (Tel, Limit): 14px, text-gray-500
├─ Type·Couleur·Taille: 12px, text-gray-500
├─ Prix: 18px, font-bold
└─ Accordéon: 14px
```

### Espacement

```
Padding card: p-4
Gap QR/Identity: gap-4
Gap visuels: gap-3
Images taille: w-24 h-24 (96×96px)
Coins images: rounded-[12px]
Coins card: rounded-[18px]
Espacement vertical: space-y-3 (accordéon)
```

---

## Interactions

### Ancien

- **Click** → Modal fiche de commande
- **Tâches chevron** → Toggle section tâches
- **Print** → Impression fiche autocollant

### Nouveau

- **Click chevron** → Toggle accordéon (smooth rotation)
- **Print (Cmd+P)** → Affiche version A4 agrandie

---

## Mode Print

### Ancien: Modal

```
┌──────────────────────┐
│ Bon de Commande · Date │
│ REF · Nom · Tel      │
│ Deadline · DTF AR    │
│                      │
│ [QR 96×96]          │
│                      │
│ Articles (si prix)   │
│                      │
└──────────────────────┘
```

### Nouveau: A4 full page

```
┌──────────────────────────────────────┐
│                                      │
│          SARAH MARTIN               │
│     +33 7 45 23 67 89               │
│                                      │
│        [IMAGE AVANT]                 │
│     DTF-2026-MARTIN-AV              │
│                                      │
│       [IMAGE ARRIÈRE]                │
│     DTF-2026-MARTIN-AR              │
│                                      │
│           150,00 €                   │
│                                      │
│     (A4 21×29.7cm, centré)          │
│                                      │
└──────────────────────────────────────┘
```

---

## Données extraites

### Ancien: `Order` + `shippingAddress`

```ts
interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  total: number;
  items: OrderItem[];
  shippingAddress?: Record<string, unknown>;
  // ...
}
```

### Nouveau: `OldaExtraData` strictement typée

```ts
interface OldaExtraData {
  commande?: string;
  nom?: string;
  prenom?: string;
  telephone?: string;
  limit?: string;           // Renamed from "deadline"
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
  };
  prt?: { /* ... */ };
  prix?: { total?: number };
  paiement?: { /* ... */ };
}
```

---

## Performance & Taille

### Ancien: TshirtOrderCard
- Dépendances: React hooks, QRCodeSVG, date-fns, lucide
- Ligne de code: ~623 lignes
- Fonctionnalités: Fiches, tâches, upload images, modal

### Nouveau: OrderCard
- Dépendances: React hooks, QRCodeSVG, date-fns, lucide
- Lignes de code: ~377 lignes
- Fonctionnalités: Bulle fermée, accordéon, print mode
- Tâches: À implémenter séparément (refactoring)

**→ Plus léger, plus modulaire**

---

## Migration Checklist

- [ ] Types: `deadline` → `limit` (REQUIRED)
- [ ] Composant: TshirtOrderCard → OrderCard
- [ ] Props: `order` → `data` (OldaExtraData)
- [ ] Intégration: olda-board.tsx
- [ ] Tester: Bulle, accordéon, print, mobile
- [ ] Archiver: TshirtOrderCard (optionnel)

---

## Résumé

| Critère | Ancien | Nouveau | Winner |
|---------|--------|---------|--------|
| Design Apple | ✓ (24px) | ✓✓ (18px premium) | 🆕 |
| Compacité | ✓ | ✓✓ | 🆕 |
| Accordéon | ✗ | ✓ | 🆕 |
| Print mode | ✓ | ✓✓ (A4 native) | 🆕 |
| Labeling | Labels explicites | Aucun label | 🆕 |
| Tâches | Intégrées | Séparées (futur) | ← À considérer |
| Visuels | Pas affiché | Avant/Arrière | 🆕 |
| Ligne de code | 623 | 377 | 🆕 |

---

**Conclusion:** Le nouveau OrderCard offre une meilleure expérience utilisateur avec un design plus épuré, Apple Premium, et des fonctionnalités mieux séparées (accordéon vs tâches).
