import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // keep xlsx on the server — it uses Node.js fs internals
  serverExternalPackages: ["xlsx"],
};

export default nextConfig;
