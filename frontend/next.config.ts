import type { NextConfig } from "next";

// Where the REST API runs. The browser only ever talks to this app's own
// /api/* paths, so cookies stay same-origin. In development they are forwarded
// to the standalone API (npm run dev -w backend); BACKEND_URL points them at
// another server. Otherwise app/api serves the API from this deployment.
const backendUrl = process.env.BACKEND_URL ?? (process.env.NODE_ENV === "development" ? "http://localhost:4000" : undefined);

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Content-Security-Policy is set per request in proxy.ts, where the nonce lives.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The shared package is TypeScript source, not pre-built.
  transpilePackages: ["@fisheye/shared"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async rewrites() {
    return backendUrl ? [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }] : [];
  },
};

export default nextConfig;
