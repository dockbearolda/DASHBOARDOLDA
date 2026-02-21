import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {/*
       * Subtle dot-grid texture — visible in light mode, barely perceptible in
       * dark mode. Gives the canvas a premium "graph paper" feel without being
       * distracting.
       */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0
          [background-image:radial-gradient(hsl(var(--border))_1px,transparent_1px)]
          [background-size:22px_22px]
          opacity-60 dark:opacity-30"
      />

      <Sidebar />

      <main className="relative z-10 ml-64 min-h-screen">{children}</main>
    </div>
  );
}
