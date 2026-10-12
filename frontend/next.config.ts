import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "recharts",
      "@clerk/nextjs",
      "@tanstack/react-query",
      "@tanstack/react-table",
      "sonner",
      "cmdk",
    ],
  },
};

export default nextConfig;
