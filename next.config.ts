import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const appDir = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  // Pin the standalone tracing root to THIS repo so `.next/standalone/server.js`
  // lands at a predictable path even when the repo is cloned inside a larger
  // workspace (parent lockfiles otherwise make Next mirror a subdirectory).
  outputFileTracingRoot: appDir,
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
