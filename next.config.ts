import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server in .next/standalone, used by the Dockerfile.
  output: "standalone",
  // Menus, saved model outputs and benchmark results are read from disk; ship them with every route.
  outputFileTracingIncludes: {
    "/**": ["./data/**/*.json", "./bench/**/*.json"],
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
