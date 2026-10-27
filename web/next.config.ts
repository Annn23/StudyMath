import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Admin dashboard is fully dynamic (Supabase auth + real-time data)
  // cacheComponents is disabled to allow cookies() in Server Components
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
