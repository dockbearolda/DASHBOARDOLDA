import type { NextConfig } from "next";

const ALLOWED_ORIGIN = "https://oldastudio.up.railway.app";

const nextConfig: NextConfig = {
  output: "standalone",

  // ── CORS headers for /api/* ────────────────────────────────────────────────
  // Belt-and-suspenders: the route file also sets these headers, but having them
  // here ensures preflight responses are correct even before the route handler
  // runs (e.g. middleware short-circuits, edge runtime, etc.).
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin",  value: ALLOWED_ORIGIN },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization, X-Webhook-Secret",
          },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      },
    ];
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "oldastudio.up.railway.app",
      },
      {
        protocol: "https",
        hostname: "*.railway.app",
      },
    ],
  },
};

export default nextConfig;
