import path from "node:path";
import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

// Security headers for every response. This app only serves a JSON API (plus redirects for
// Google sign-in), so the policy can be as strict as possible: nothing may be loaded,
// framed or sniffed, and auth responses must never be cached.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'; base-uri 'none'" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // HTTPS only; browsers ignore it over plain http, so it's only sent in production.
  ...(isProduction ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  // Pin the project root: a stray package-lock.json in a parent folder (e.g. the user's home
  // directory) otherwise makes Next.js pick that folder as the workspace root.
  turbopack: {
    root: path.join(__dirname),
  },
  poweredByHeader: false,
  headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Tokens and user data must never be stored by the browser or a proxy cache.
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
