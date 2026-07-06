import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native/server-only packages that must not be bundled by Turbopack
  serverExternalPackages: ["better-sqlite3", "unzipper", "@libsql/client"],
  // Bundle the committed demo sample files into the serverless functions that
  // read them, so the seeded demo's PDFs/docs are viewable on Vercel (where
  // only files traced into each function's bundle are available at runtime).
  outputFileTracingIncludes: {
    "/api/projects/[id]/resources/[rid]": ["./samples/**"],
    "/api/projects/[id]/resources/[rid]/file": ["./samples/**"],
    "/api/projects/[id]/build-log": ["./samples/**"],
  },
};

export default nextConfig;
