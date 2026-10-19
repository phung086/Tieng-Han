import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(process.env.HANEUL_STANDALONE === "1" ? { output: "standalone" as const } : {}),
  // User textbooks and queues are runtime volumes, never deployment assets.
  outputFileTracingExcludes: { "/*": ["./.haneul/**/*", "./.env*"] },
};

export default nextConfig;
