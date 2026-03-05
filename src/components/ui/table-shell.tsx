"use client";

/**
 * OrderTable — Shell commun Apple-style pour tous les tableaux du dashboard.
 *
 * • Carte blanche arrondie (rounded-2xl) avec ombre Apple subtile
 * • Slot toolbar : zone au-dessus des en-têtes (boutons, titre, recherche…)
 * • En-têtes sticky dans le conteneur scroll
 * • Slot footer optionnel
 * • Police Inter + antialiasing garantis dans tous les contextes
 *
 * Usage minimal :
 *   <OrderTable headers={<MyHeaders />}>
 *     <MyRows />
 *   </OrderTable>
 *
 * Usage complet :
 *   <OrderTable
 *     toolbar={<MyToolbar />}
 *     headers={<MyHeaders />}
 *     footer={<MyFooter />}
 *     minWidth={900}
 *     className="flex-1 min-h-0"
 *     bodyClassName="overflow-auto flex-1 min-h-0"
 *   >
 *     <MyRows />
 *   </OrderTable>
 */

import { cn } from "@/lib/utils";
import type { CSSProperties, ReactNode } from "react";

// ── Tokens partagés ───────────────────────────────────────────────────────────────

/** Police Apple-style réutilisable */
export const APPLE_FONT_STYLE: CSSProperties = {
  fontFamily:          "'Inter', 'Inter Variable', -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif",
  WebkitFontSmoothing: "antialiased",
  MozOsxFontSmoothing: "grayscale",
};

/** Ombre Apple : légère profondeur + anneau de contour 1 px */
export const APPLE_SHADOW_STYLE: CSSProperties = {
  boxShadow: "0 1px 3px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.05)",
};

// ── Props ─────────────────────────────────────────────────────────────────────────

interface OrderTableProps {
  /** Barre au-dessus des en-têtes : titre, boutons, recherche… */
  toolbar?: ReactNode;
  /** En-têtes de colonnes — sticky dans le scroll container */
  headers: ReactNode;
  /** Lignes / contenu du corps */
  children: ReactNode;
  /** Zone sous les lignes (pagination, total, légende…) */
  footer?: ReactNode;
  /**
   * Largeur minimale pour le scroll horizontal (ex : 900 pour un tableau
   * large sur iPad). Par défaut : pas de min-width.
   */
  minWidth?: number;
  /**
   * Classes Tailwind supplémentaires sur la carte.
   * Ex : "flex-1 min-h-0 h-full" pour remplir le conteneur parent.
   */
  className?: string;
  /**
   * Classes Tailwind sur le conteneur scrollable.
   * Ex : "overflow-auto flex-1 min-h-0" pour un scroll interne fixe.
   * Par défaut : "overflow-y-auto" (auto-height).
   */
  bodyClassName?: string;
}

// ── Composant ─────────────────────────────────────────────────────────────────────

export function OrderTable({
  toolbar,
  headers,
  children,
  footer,
  minWidth,
  className,
  bodyClassName,
}: OrderTableProps) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl bg-white overflow-hidden",
        className,
      )}
      style={{ ...APPLE_FONT_STYLE, ...APPLE_SHADOW_STYLE }}
    >
      {/* Toolbar slot */}
      {toolbar && (
        <div className="shrink-0 border-b border-black/[0.06] bg-white">
          {toolbar}
        </div>
      )}

      {/* Zone scrollable : headers sticky + corps */}
      <div className={cn("overflow-y-auto", bodyClassName)}>
        <div style={minWidth ? { minWidth } : undefined}>
          {/* En-têtes collants */}
          <div className="sticky top-0 z-10 bg-[#f5f5f7] border-b border-black/[0.06]">
            {headers}
          </div>

          {/* Corps */}
          {children}
        </div>
      </div>

      {/* Footer slot */}
      {footer && (
        <div className="shrink-0 border-t border-black/[0.05] bg-[#f9f9fb]">
          {footer}
        </div>
      )}
    </div>
  );
}
