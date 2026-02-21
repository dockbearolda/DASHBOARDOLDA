"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export function Header({ title }: { title?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-30 flex h-[60px] items-center gap-4 border-b border-border/50 bg-background/85 backdrop-blur-2xl px-5">

      {/* Left — breadcrumb title or global search */}
      <div className="flex-1">
        {title ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">OLDA Studio</span>
            <span className="text-muted-foreground/40 text-xs">/</span>
            <h1 className="text-sm font-semibold tracking-tight">{title}</h1>
          </div>
        ) : (
          <div className="relative max-w-[280px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher une commande..."
              className="pl-8 h-8 text-sm bg-muted/60 border-border/40 focus-visible:border-border placeholder:text-muted-foreground/60 rounded-xl"
            />
          </div>
        )}
      </div>

      {/* Right — actions + avatar */}
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative h-8 w-8 rounded-xl hover:bg-muted/70")}
          aria-label="Notifications"
        >
          <Bell className="h-3.5 w-3.5" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500 ring-1 ring-background" />
        </Button>

        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Basculer le thème"
            className="h-8 w-8 rounded-xl hover:bg-muted/70"
          >
            {theme === "dark" ? (
              <Sun className="h-3.5 w-3.5" />
            ) : (
              <Moon className="h-3.5 w-3.5" />
            )}
          </Button>
        )}

        <div className="mx-1 h-4 w-px bg-border/60" />

        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-violet-400 via-violet-500 to-indigo-600 flex items-center justify-center text-white text-[11px] font-semibold shadow-sm ring-1 ring-border/30">
          AD
        </div>
      </div>
    </header>
  );
}
