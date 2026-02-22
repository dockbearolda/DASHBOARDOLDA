"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  ShoppingBag,
  BarChart3,
  Settings,
  Webhook,
  Sparkles,
  Factory,
} from "lucide-react";
import { cn } from "@/lib/utils";

const primaryNav = [
  { label: "Vue d'ensemble",  href: "/dashboard",          icon: LayoutDashboard },
  { label: "Dashboard OLDA",  href: "/dashboard/olda",     icon: Factory },
  { label: "Commandes",       href: "/dashboard/orders",   icon: ShoppingBag },
  { label: "Analytiques",     href: "/dashboard/analytics", icon: BarChart3 },
];

const secondaryNav = [
  { label: "Webhook",       href: "/dashboard/webhook",  icon: Webhook },
  { label: "Paramètres",   href: "/dashboard/settings", icon: Settings },
];

function NavItem({
  item,
  isActive,
}: {
  item: { label: string; href: string; icon: React.ComponentType<{ className?: string }> };
  isActive: boolean;
}) {
  return (
    <Link href={item.href}>
      <div className="relative">
        {isActive && (
          <motion.div
            layoutId="sidebar-active"
            className="absolute inset-0 rounded-[10px] bg-foreground"
            transition={{ type: "spring", stiffness: 450, damping: 38 }}
          />
        )}
        <div
          className={cn(
            "relative flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm font-medium transition-colors duration-150",
            isActive
              ? "text-background"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/70"
          )}
        >
          <item.icon className="h-[15px] w-[15px] shrink-0" />
          {item.label}
        </div>
      </div>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href);

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-full w-64 flex-col border-r border-border/50 bg-background/85 backdrop-blur-2xl">
      {/* ── Logo ─────────────────────────────────────────────────────── */}
      <div className="flex h-[60px] shrink-0 items-center gap-3 px-5 border-b border-border/50">
        {/* Gradient logo mark */}
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-foreground/90 to-foreground ring-1 ring-border/30 shadow-sm">
          <Sparkles className="h-3.5 w-3.5 text-background" />
        </div>
        <div>
          <p className="text-[13px] font-semibold leading-tight tracking-tight">
            OLDA Studio
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight">
            Dashboard admin
          </p>
        </div>
      </div>

      {/* ── Primary navigation ───────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          Principal
        </p>
        {primaryNav.map((item) => (
          <NavItem key={item.href} item={item} isActive={isActive(item.href)} />
        ))}

        <div className="my-3 border-t border-border/50" />

        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          Configuration
        </p>
        {secondaryNav.map((item) => (
          <NavItem key={item.href} item={item} isActive={isActive(item.href)} />
        ))}
      </nav>

      {/* ── Footer status ────────────────────────────────────────────── */}
      <div className="shrink-0 p-3 border-t border-border/50">
        <div className="flex items-center gap-2.5 rounded-xl bg-muted/50 ring-1 ring-border/30 px-3 py-2.5">
          {/* Animated green dot */}
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-medium text-foreground">
              oldastudio.up.railway.app
            </p>
            <p className="text-[10px] text-muted-foreground">Boutique connectée</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
