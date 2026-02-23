import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/layout/theme-provider";
import "./globals.css";

// ── Viewport: prevent iOS pinch-zoom, honour notch/home-indicator ─────────────
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",   // env(safe-area-inset-*) active
};

/*
 * Inter is the closest open-source match to Apple's SF Pro and Vercel's Geist.
 * We map it to the CSS custom property that globals.css already references so
 * no other file needs changing.
 */
const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "OLDA Studio — Dashboard",
  description: "Dashboard de gestion des commandes OLDA Studio",
  // Apple Web App — allows "Add to Home Screen" as a native-feel PWA
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "OLDA Dashboard",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${fontSans.variable} ${fontMono.variable} antialiased font-sans`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                borderRadius: "14px",
                backdropFilter: "blur(16px)",
                fontSize: "13px",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
