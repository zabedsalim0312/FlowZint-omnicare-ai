import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // In Next.js 16, it is "turbopack" at the top level, not inside experimental!
  turbopack: {
    root: '..', // This tells Next.js the root is one folder up
  },
};

export default nextConfig;