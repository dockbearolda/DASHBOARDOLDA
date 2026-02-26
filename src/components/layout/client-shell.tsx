"use client";

/**
 * ClientShell — wraps Sidebar + main, masks both for /dashboard/olda (atelier full-width).
 */
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { cn } from "@/lib/utils";

export function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const isAtelier = pathname.startsWith("/dashboard/olda");

  return (
    <div className="min-h-screen bg-white">
      {!isAtelier && <Sidebar />}
      <main className={cn("relative min-h-screen", !isAtelier && "ml-0 md:ml-64")}>
        {children}
      </main>
    </div>
  );
}
