# 🚀 Quick Reference — OrderCard Refonte

## Files Created/Modified

```
✅ src/types/order.ts                    — OldaExtraData updated
✅ src/components/olda/order-card.tsx    — New component (377 lines)
```

## Component Props

```tsx
interface OrderCardProps {
  data: OldaExtraData;      // Required: order data
  orderId?: string;         // Required for print/localStorage
  onDelete?: () => void;    // Future
  onEdit?: () => void;      // Future
}
```

## Usage

```tsx
import { OrderCard } from "@/components/olda/order-card";

<OrderCard
  data={order.shippingAddress as OldaExtraData || {}}
  orderId={order.id}
/>
```

## Key Features

| Feature | How | Status |
|---------|-----|--------|
| Bubble (closed) | Default state | ✅ |
| Accordion | Chevron click | ✅ |
| Print mode | Cmd+P (A4) | ✅ |
| No labels | "XL" not "Taille: XL" | ✅ |
| Hide empty | No blank rows | ✅ |
| Apple design | 18px, #E5E5E5, SF Pro | ✅ |

## Data Structure

```ts
OldaExtraData {
  commande?: string;
  nom?: string;
  prenom?: string;
  telephone?: string;
  limit?: string;                    // NEW: was "deadline"
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
  
  prt?: {
    refPrt?: string;
    taillePrt?: string;
    quantite?: number;
  };
  
  prix?: {
    total?: number;                // Centimes → auto convert to €
  };
  
  paiement?: {
    statut?: "OUI" | "NON" | "PAID" | "PENDING";
  };
}
```

## Integration (5 steps)

1. **Import**
   ```tsx
   import { OrderCard } from "./order-card";
   import type { OldaExtraData } from "@/types/order";
   ```

2. **Extract data**
   ```tsx
   const data = order.shippingAddress as OldaExtraData || {};
   ```

3. **Render**
   ```tsx
   <OrderCard data={data} orderId={order.id} />
   ```

4. **Test**
   - Bubble closed ✓
   - Chevron opens accordion ✓
   - Print works (Cmd+P) ✓
   - Mobile responsive ✓

5. **Optional: Archive**
   ```
   Delete or move: src/components/olda/tshirt-order-card.tsx
   ```

## Design Constants

```css
Corner radius:    18px (rounded-[18px])
Border:          1px solid #E5E5E5
Background:      #FFFFFF
Typography:      -apple-system, BlinkMacSystemFont, "SF Pro Display"
Image size:      96×96px (w-24 h-24)
Image corner:    12px (rounded-[12px])
Shadow:          0 1px 8px rgba(0,0,0,0.05)
Shadow hover:    0 6px 24px rgba(0,0,0,0.09)
```

## Spacing

```
Card padding:      p-4
QR/Identity gap:   gap-4
Visual gap:        gap-3
Accordion spacing: space-y-3
```

## Typography

```
Prenom Nom:        16px / bold / UPPERCASE
Tel/Limit:         14px / text-gray-500
Type·Color·Size:   12px / text-gray-500
Price:             18px / bold
Accordion items:   14px
```

## Print Mode

**Triggers:** Cmd+P (Mac) or Ctrl+P (Windows)

**Output:**
- Full A4 page (210×297mm)
- Images enlarged 50% width
- All UI hidden
- Ready for workshop printing

## Common Patterns

### Empty values handling
```tsx
{/* Only shown if value exists */}
{telephone && <p>{telephone}</p>}
```

### DTF code detection
```tsx
isDtfCode(visuelAvant)  // true if no http/data: prefix
// → Display in monospace, bg-gray-50
```

### Price formatting
```tsx
fmtPrice(centimes)  // 1500 → "15,00 €"
```

### Limit label
```tsx
limitLabel(dateString)  // "2026-02-28" → "Dans 3j · 28 fév"
```

## Component Structure

```
<div> (18px rounded, white bubble)
  ├─ <Header> (QR + Identity)
  │  ├─ QRCodeSVG (64×64)
  │  ├─ Prenom Nom (bold UPPERCASE)
  │  ├─ Telephone
  │  └─ Limit label
  │
  ├─ <Visuals> (if present)
  │  ├─ Avant (96×96)
  │  └─ Arrière (96×96)
  │
  ├─ <Infos> (Type·Color·Size)
  │
  ├─ <Price> (right-aligned, bold)
  │
  └─ <Chevron> (if details available)
     
<Accordion> (if open)
  ├─ Collection
  ├─ Reference
  ├─ Size
  ├─ Note
  └─ PRT block
```

## Testing Checklist

- [ ] Bubble displays closed state
- [ ] Chevron visible with content
- [ ] Chevron click opens accordion
- [ ] Smooth rotation animation
- [ ] Empty values hidden
- [ ] Images display side-by-side
- [ ] DTF codes in monospace
- [ ] Price in euros (centimes converted)
- [ ] Print mode A4 (Cmd+P)
- [ ] Mobile responsive
- [ ] No console errors

## Troubleshooting

**Chevron not visible?**
→ Check if collection/reference/taille/note/prt has values

**Images not showing?**
→ Check data.fiche?.visuelAvant/Arriere or localStorage

**Print shows nothing?**
→ Verify .olda-card-print class in render

**Price wrong?**
→ Ensure prix.total is in centimes (÷100 for euros)

**DTF code displays as image?**
→ Code should NOT start with "http://" or "data:"

## Documentation Links

- **IMPLEMENTATION_GUIDE.md** — Full guide + architecture
- **USAGE_EXAMPLE.md** — Code examples
- **DESIGN_COMPARISON.md** — Old vs New comparison
- **REFONTE_SUMMARY.md** — Overview
- **COMPLETION_REPORT.md** — Final report

---

**Status:** ✅ Ready for production integration

**Estimated time:** 40-50 min (including testing)

**Contact:** See IMPLEMENTATION_GUIDE.md for support
