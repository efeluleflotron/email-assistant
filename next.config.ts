import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Bundle migration files so they're available in serverless deployments.
  outputFileTracingIncludes: {
    "/api/admin/migrate": ["./src/db/migrations/**/*"],
  },
};

export default nextConfig;
