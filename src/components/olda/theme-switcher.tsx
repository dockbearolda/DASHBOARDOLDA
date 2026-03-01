"use client";

/**
 * ThemeSwitcher — Bascule mode nuit/clair
 * ─ Moon/Sun : toggle dark/light via next-themes
 */

import { useEffect, useState, useCallback } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const toggleDark = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  if (!mounted) return <div className="h-7 w-7 rounded-lg bg-transparent" />;

  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleDark}
      title={isDark ? "Mode clair" : "Mode nuit"}
      aria-label={isDark ? "Passer en mode clair" : "Passer en mode nuit"}
      className={cn(
        "h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
        "bg-muted/80 border border-border/60",
        "text-muted-foreground hover:text-foreground transition-colors duration-150",
      )}
    >
      {isDark
        ? <Sun  className="h-3.5 w-3.5" />
        : <Moon className="h-3.5 w-3.5" />
      }
    </button>
  );
}
