"use client";

/**
 * ClientShell — wraps Sidebar + main, masks both for /dashboard/olda (atelier full-width).
 */
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { cn } from "@/lib/utils";

const TEAM_LABELS: Record<string, string> = {
  loic:     "Loïc",
  charlie:  "Charlie",
  melina:   "Mélina",
  amandine: "Amandine",
  renaud:   "Renaud",
};

export function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const isAtelier = pathname.startsWith("/dashboard/olda");

  const [user,          setUser]          = useState<string | null>(null);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [showConfirm,   setShowConfirm]   = useState(false);

  // Récupérer l'utilisateur connecté (une seule fois au montage)
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user ?? null))
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    if (!showConfirm) { setShowConfirm(true); return; }
    setLogoutLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      {!isAtelier && <Sidebar />}
      <main className={cn("relative min-h-screen", !isAtelier && "ml-0 md:ml-64")}>
        {children}
      </main>

      {/* ── Badge utilisateur + déconnexion — bas droite ──────────────────── */}
      {user && (
        <div
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2"
          onMouseLeave={() => setShowConfirm(false)}
        >
          {showConfirm && (
            <span className="text-[12px] font-medium text-slate-500 bg-white px-2.5 py-1.5 rounded-lg shadow-sm border border-slate-100 whitespace-nowrap animate-in fade-in slide-in-from-right-2 duration-150">
              Confirmer ?
            </span>
          )}
          <button
            onClick={handleLogout}
            disabled={logoutLoading}
            title={`Connecté en tant que ${TEAM_LABELS[user] ?? user} — Cliquer pour se déconnecter`}
            className={cn(
              "flex items-center gap-2 h-8 px-3 rounded-full text-[12px] font-semibold",
              "bg-white border border-slate-200 shadow-sm",
              "transition-all duration-150 select-none",
              showConfirm
                ? "text-red-500 border-red-200 bg-red-50 hover:bg-red-100"
                : "text-slate-500 hover:border-slate-300 hover:bg-slate-50",
            )}
          >
            <span className="h-5 w-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
              {(TEAM_LABELS[user] ?? user).charAt(0).toUpperCase()}
            </span>
            {showConfirm ? (logoutLoading ? "…" : "Se déconnecter") : (TEAM_LABELS[user] ?? user)}
          </button>
        </div>
      )}
    </div>
  );
}
