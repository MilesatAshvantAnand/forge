import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native/server-only packages that must not be bundled by Turbopack
  serverExternalPackages: ["better-sqlite3", "unzipper"],
};

export default nextConfig;
