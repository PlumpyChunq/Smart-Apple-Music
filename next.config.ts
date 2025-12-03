import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker/Podman deployment
  // Creates a minimal .next/standalone folder with only necessary files
  output: "standalone",

  // Explicitly set workspace root to prevent path issues in standalone output
  // Fixes nested paths when parent directories contain lockfiles
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
