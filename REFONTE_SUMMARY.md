# 📋 Résumé Refonte OrderCard

## 🎯 Objectif
Refonte complète et intégrale du composant OrderCard (TshirtOrderCard) avec:
- Esthétique Apple Premium (design bulle fermée)
- Architecture de données stricte (clés spécifiques)
- Mode accordéon pour détails secondaires
- Mode print optimisé pour Renaud (atelier)
- Remplacement "deadline" → "limit"

## ✅ Travail complété

### 1. Types mis à jour (`src/types/order.ts`)

**Interface OldaExtraData — Nouvelle version:**
```ts
export interface OldaExtraData {
  // Identité
  commande?: string;
  nom?: string;
  prenom?: string;
  telephone?: string;

  // Dates
  limit?: string;  // Renamed from "deadline"

  // Références
  collection?: string;
  reference?: string;
  taille?: string;
  note?: string;

  // Fiche (visuels + spécifications)
  fiche?: {
    visuelAvant?: string;
    visuelArriere?: string;
    tailleDTFAr?: string;
    typeProduit?: string;
    couleur?: string;
  };

  // Impression (PRT)
  prt?: {
    refPrt?: string;
    taillePrt?: string;
    quantite?: number;
  };

  // Paiement
  paiement?: {
    statut?: "OUI" | "NON" | "PAID" | "PENDING";
  };

  // Prix en centimes
  prix?: {
    total?: number;
  };

  // Marqueur d'origine
  _source?: "olda_studio";
}
```

### 2. Nouveau composant (`src/components/olda/order-card.tsx`)

**Fichier créé:** 377 lignes

**Fonctionnalités:**

#### Bulle Fermée (Par défaut)
```
┌────────────────────────────┐
│ [QR] PRENOM NOM           │
│      +33 6 12 34 56 78    │
│      Limit: Dans 3j · 15j │
│      Noir · XL · T-shirt  │
│                     15€   │
│                 ▼ (click) │
└────────────────────────────┘
```

- **QR Code**: 64×64px, SVG
- **Header**: PRENOM NOM en bold UPPERCASE
- **Infos**: telephone + limit (gris léger)
- **Visuels**: Avant/Arrière côte à côte (96×96px, coins 12px, bordure #E5E5E5)
- **Type·Couleur·Taille**: 1 ligne discrète (12px gris)
- **Prix**: Droite (18px bold)
- **Chevron**: Centré, visible si détails

#### Accordéon (Au clic)
Affiche:
- collection
- reference
- taille
- note
- Bloc PRT (refPrt, taillePrt, quantite)

#### Mode Print (@media print)
- A4 (21cm × 29.7cm)
- Images agrandies (50% largeur)
- UI masquée (visibility: hidden)
- Images Avant/Arrière visibles et lisibles

#### Design Apple
```css
Coins: 18px (rounded-[18px])
Bordure: 1px solid #E5E5E5
Fond: #FFFFFF
Typo: -apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, sans-serif
Ombre: 0 1px 8px rgba(0,0,0,0.05) | hover: 0 6px 24px rgba(0,0,0,0.09)
```

#### Règles strictes
- ✅ Aucun label ("XL" pas "Taille: XL")
- ✅ Valeurs vides = rien affiché (pas de lignes vides)
- ✅ Centimes → € conversion automatique
- ✅ Détection DTF codes vs images

## 📦 Props du composant

```tsx
export interface OrderCardProps {
  data: OldaExtraData;        // Données strictement typées
  orderId?: string;            // Pour localStorage + QR
  onDelete?: () => void;       // Futur
  onEdit?: () => void;         // Futur
}
```

## 🔄 Comment utiliser

### Import
```tsx
import { OrderCard } from "@/components/olda/order-card";
```

### Utilisation
```tsx
const data: OldaExtraData = {
  commande: "CMD-001",
  nom: "Dupont",
  prenom: "Jean",
  telephone: "+33 6 12 34 56 78",
  limit: "2026-02-28",
  collection: "Printemps 2026",
  reference: "PACK-NOIR-L",
  taille: "Large",
  note: "À faire demain!",
  fiche: {
    visuelAvant: "DTF-AV-001",
    visuelArriere: "DTF-AR-001",
    tailleDTFAr: "A4",
    typeProduit: "T-shirt",
    couleur: "Noir",
  },
  prt: {
    refPrt: "PRT-2026-01",
    taillePrt: "XL",
    quantite: 50,
  },
  prix: {
    total: 1500, // 15,00 €
  },
};

export default function MyComponent() {
  return <OrderCard data={data} orderId="cmd-001" />;
}
```

## 🔗 Intégration dans `olda-board.tsx`

**Point d'intégration:** Ligne ~300 (à vérifier)

**Avant:**
```tsx
import { TshirtOrderCard } from "./tshirt-order-card";
<TshirtOrderCard order={o} isNew={newOrderIds?.has(o.id)} />
```

**Après:**
```tsx
import { OrderCard } from "./order-card";
<OrderCard data={o.shippingAddress as OldaExtraData || {}} orderId={o.id} />
```

## 📋 Checklist d'intégration

- [ ] Vérifier imports dans olda-board.tsx
- [ ] Remplacer TshirtOrderCard par OrderCard
- [ ] Tester avec données Olda Studio
- [ ] Vérifier print mode (Cmd+P ou Ctrl+P)
- [ ] Tester accordéon (chevron click)
- [ ] Valider que valeurs vides ne s'affichent pas
- [ ] Responsive mobile (devtools mobile view)
- [ ] Archiver TshirtOrderCard si tout OK

## 📁 Fichiers affectés

| Fichier | Action | Statut |
|---------|--------|--------|
| `src/types/order.ts` | Mise à jour OldaExtraData | ✅ Complété |
| `src/components/olda/order-card.tsx` | Créé (377 lignes) | ✅ Complété |
| `src/components/olda/olda-board.tsx` | À mettre à jour (intégration) | ⏳ En attente |
| `src/components/olda/tshirt-order-card.tsx` | À archiver (optionnel) | ⏳ En attente |

## 🎨 Points clés du design

1. **Pas de labels explicites**
   - ✅ Afficher: "Noir · XL · T-shirt"
   - ❌ Afficher: "Couleur: Noir, Taille: XL, Type: T-shirt"

2. **Valeurs vides = invisibles**
   - Si `data.fiche?.couleur` est undefined → ne pas afficher la ligne

3. **Images**
   - Priorité: localStorage > data.fiche.visuelAvant/Arriere
   - DTF codes: bg-gray-50, font-mono, centré
   - Images: object-cover, rounded-[12px]

4. **Accordéon**
   - Chevron visible seulement si contenu disponible
   - Animation smooth (transition-transform duration-200)
   - Chevron rotate-180 quand ouvert

5. **Print mode**
   - CSS @media print
   - `.olda-card-print` visible, tout le reste hidden
   - Images agrandies au centre

## 🚀 Améliorations futures

- [ ] Animation fade-up au premier affichage
- [ ] Support multiple images (carousel)
- [ ] Édition inline des données
- [ ] Export PDF per order
- [ ] Validation zod/joi des données
- [ ] Callbacks onDelete/onEdit

## 📝 Notes Renaud (Atelier)

Le mode print affiche:
- Client (Prenom Nom)
- Images Avant/Arrière agrandies (50% width)
- Téléphone
- Format A4 (21×29.7cm)

Parfait pour l'impression 📎

## 📞 Documentation

Voir `IMPLEMENTATION_GUIDE.md` pour:
- Guide complet d'intégration
- Exemple d'utilisation détaillé
- Spécifications de design
- Checklist de validation

---

**Date:** 2026-02-24
**Statut:** ✅ Code prêt pour intégration
**Prochaines étapes:** Intégrer dans olda-board.tsx et tester
