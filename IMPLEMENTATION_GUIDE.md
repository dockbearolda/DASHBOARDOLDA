# 🎯 Refonte OrderCard — Guide d'Intégration

## ✅ Phase 1 — COMPLÉTÉE

### Types mis à jour (`src/types/order.ts`)
- ✅ Interface `OldaExtraData` refactorisée avec clés strictes
- ✅ Renommage: `deadline` → `limit`
- ✅ Nouvelles clés: `commande`, `prenom`, `collection`, `taille`, `note`
- ✅ Structure `fiche`: `visuelAvant`, `visuelArriere`, `tailleDTFAr`, `typeProduit`, `couleur`
- ✅ Structure `prt`: `refPrt`, `taillePrt`, `quantite`
- ✅ Structure `prix`: `total` (en centimes)
- ✅ Structure `paiement`: `statut`

### Composant créé (`src/components/olda/order-card.tsx`)
- ✅ 377 lignes de code
- ✅ Design Apple Premium (18px coins, #FFFFFF, #E5E5E5 bordure, SF Pro)
- ✅ État bulle fermée (par défaut)
- ✅ État accordéon (détails déployables)
- ✅ Mode print (@media print pour A4)
- ✅ Aucun label (valeurs pures)
- ✅ Valeurs vides non affichées

---

## 📋 Architecture du nouveau composant

### État FERMÉ (Bulle)

```
┌─────────────────────────────────────┐
│ [QR]  PRENOM NOM              │
│ 64×64 +33 6 12 34 56 78        │
│       Limit: Dans 3j · 15 jan  │
│       Noir · XL · T-shirt      │
│                          15€   │
│                    ▼ (chevron) │
└─────────────────────────────────────┘
```

**Sections:**
- **Header**: QR 64×64px + Identité (PRENOM NOM en bold UPPERCASE)
- **Téléphone + Limit**: Texte gris léger
- **Visuels**: Avant/Arrière côte à côte, carrés 96×96px, bordure #E5E5E5, coins 12px
- **Infos**: type · couleur · taille (1 ligne discrète)
- **Prix**: Droite, conversion centimes → €
- **Chevron**: Centré, visible si détails disponibles

### État OUVERT (Accordéon)

Affiche au clic:
- `collection`
- `reference`
- `taille`
- `note`
- Bloc **PRT**: `refPrt`, `taillePrt`, `quantite`

### Mode PRINT

- @media print: seul le bloc `.olda-card-print` s'affiche
- Images agrandies (50% de la largeur)
- A4 (210×297mm)
- UI masquée (`visibility: hidden`)

---

## 🔄 Intégration dans `olda-board.tsx`

### Avant (actuel)

```tsx
import { TshirtOrderCard } from "./tshirt-order-card";

// ...
<TshirtOrderCard order={o} isNew={newOrderIds?.has(o.id)} />
```

### Après (nouveau)

```tsx
import { OrderCard } from "./order-card";

// ... dans le rendu:
<OrderCard
  data={o.shippingAddress as OldaExtraData || {}}
  orderId={o.id}
/>
```

### Points clés:

1. **Props du nouveau composant:**
   - `data: OldaExtraData` — strictement typée
   - `orderId?: string` — pour localStorage et QR
   - `onDelete?: () => void` — futur (pas implémenté)
   - `onEdit?: () => void` — futur (pas implémenté)

2. **Différences de props:**
   - Ancien: `order: Order` (objet complexe)
   - Nouveau: `data: OldaExtraData` (données strictes)
   - Ancien: `isNew?: boolean` (animation)
   - Nouveau: pas d'animation (à ajouter si nécessaire)

3. **Extraction des données:**
   ```tsx
   // Les données Olda Studio viennent de:
   const data = order.shippingAddress as OldaExtraData || {};

   <OrderCard data={data} orderId={order.id} />
   ```

---

## 🛠️ Checklist d'intégration

### Étape 1: Vérifier les imports
- [ ] `OrderCard` importé dans `olda-board.tsx`
- [ ] `OldaExtraData` disponible depuis `src/types/order.ts`

### Étape 2: Remplacer `TshirtOrderCard`
- [ ] Remplacer l'import: `TshirtOrderCard` → `OrderCard`
- [ ] Adapter le rendu: `<TshirtOrderCard order={o} />` → `<OrderCard data={o.shippingAddress as OldaExtraData} orderId={o.id} />`

### Étape 3: Tester
- [ ] Bulle fermée affiche: QR + prenom + nom + telephone + limit + images + type·couleur·taille + prix
- [ ] Chevron déploie: collection, reference, taille, note, prt.*
- [ ] Valeurs vides ne s'affichent pas
- [ ] Print mode: images agrandies, UI masquée, A4
- [ ] Responsive (mobile 18px corners OK)

### Étape 4: Nettoyer (optionnel)
- [ ] Archiver ou supprimer `src/components/olda/tshirt-order-card.tsx`
- [ ] Mettre à jour les commentaires dans `olda-board.tsx`

---

## 📊 Données de test

```ts
const testData: OldaExtraData = {
  commande: "CMD-001",
  nom: "Dupont",
  prenom: "Jean",
  telephone: "+33 6 12 34 56 78",
  limit: "2026-02-28",
  collection: "Printemps 2026",
  reference: "PACK-NOIR-L",
  taille: "Large",
  note: "Urgence: à faire demain!",
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
  paiement: {
    statut: "PAID",
  },
};
```

---

## 🎨 Design Specifications

### Constantes
```
Coins: 18px
Bordure: 1px solid #E5E5E5
Fond: #FFFFFF
Typo: -apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, sans-serif
Ombre: 0 1px 8px rgba(0,0,0,0.05) | hover: 0 6px 24px rgba(0,0,0,0.09)
```

### Images (Visuels)
```
Taille: 96×96px (w-24 h-24)
Coins: 12px (rounded-[12px])
Bordure: 1px solid #E5E5E5
Espace: 12px gap-3
Contenu: object-cover
DTF codes: bg-gray-50 + font-mono
```

### Typo
```
Prenom Nom: 16px / font-bold / UPPERCASE
Telephone: 14px / text-gray-500
Limit: 14px / text-gray-500
Infos: 12px / text-gray-500
Prix: 18px / font-bold
```

### État Ouvert
```
Fond: bg-gray-50
Padding: p-4
Spacing: space-y-3
Bloc PRT: border + rounded-lg + bg-white + p-3
```

---

## 🔍 Règles strictes

✅ **AFFICHER:**
- Uniquement les valeurs présentes et non vides
- Pas de texte par défaut ("—", "N/A")
- Pas de lignes vides

❌ **NE PAS AFFICHER:**
- Labels explicites ("Taille:", "Couleur:", etc.)
- Valeurs undefined, null, ou empty string
- Lignes avec seulement du texte d'espace

### Exemple:
- ✅ `"Noir · XL · T-shirt"` (3 valeurs)
- ✅ `"Noir · T-shirt"` (2 valeurs, taille manquante)
- ✅ Rien (tous vides)
- ❌ `"Taille : XL"` (label explicite)
- ❌ `"Noir · · T-shirt"` (espace pour valeur manquante)

---

## 📱 Responsive

- Mobile: 18px coins OK (tailwind `rounded-[18px]`)
- Tablet/Desktop: même design
- Print: A4 (21cm × 29.7cm)

---

## 🚀 Intégration future

### À ajouter:
- [ ] `onDelete` callback
- [ ] `onEdit` callback
- [ ] Animation d'entrée (fade-up) comme l'ancien composant
- [ ] Support pagination d'images (si > 2)
- [ ] Édition inline (mode draft)

### À considérer:
- [ ] Validation stricte des données (zod/joi)
- [ ] Caching d'images locales amélioré
- [ ] Export PDF per order

---

## 📞 Support

**Fichiers clés:**
- `src/components/olda/order-card.tsx` — Composant principal (377 lignes)
- `src/types/order.ts` — Interfaces OldaExtraData & OldaCommandePayload
- `src/components/olda/olda-board.tsx` — Point d'intégration

**Contact:** Consulter la documentation STUDIOOLDA pour questions sur le format de données.
