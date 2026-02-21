// No "use client" — stays a Server Component so LucideIcon props can be
// passed from server pages without hitting the Next.js serialisation limit.
// The entrance animation is driven by the CSS `animate-fade-up` keyframe
// defined in globals.css; only `animation-delay` needs an inline style.

import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: number;
  iconColor?: string;
  /** Stagger offset in seconds (default 0) */
  delay?: number;
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  iconColor = "text-foreground",
  delay = 0,
}: StatsCardProps) {
  const TrendIcon =
    trend === undefined || trend === 0
      ? Minus
      : trend > 0
      ? TrendingUp
      : TrendingDown;

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-6 hover:border-border hover:shadow-md hover:shadow-black/[0.04] dark:hover:shadow-black/20 transition-all duration-300 animate-fade-up"
      style={{ animationDelay: `${delay}s` }}
    >
      {/* Top-edge glint on hover */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            {title}
          </p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className={cn("rounded-xl p-2.5 bg-muted/70 ring-1 ring-border/40", iconColor)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>

      {trend !== undefined && (
        <div className="mt-4 flex items-center gap-1.5">
          <TrendIcon
            className={cn(
              "h-3.5 w-3.5",
              trend > 0 ? "text-emerald-500" : trend < 0 ? "text-red-500" : "text-muted-foreground"
            )}
          />
          <span
            className={cn(
              "text-xs font-medium",
              trend > 0 ? "text-emerald-500" : trend < 0 ? "text-red-500" : "text-muted-foreground"
            )}
          >
            {trend > 0 ? "+" : ""}{trend}% vs hier
          </span>
        </div>
      )}
    </div>
  );
}
