import type { NextConfig } from "next";

// Where the REST API runs. The browser only ever talks to this app's own
// /api/* paths, which are forwarded here, so cookies stay same-origin.
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  // The shared package is TypeScript source, not pre-built.
  transpilePackages: ["@fisheye/shared"],
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
};

export default nextConfig;
