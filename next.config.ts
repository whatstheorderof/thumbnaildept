import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Large files (client photos, references) upload straight from the browser to
  // Supabase Storage via signed upload URLs, so server actions stay small.
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
