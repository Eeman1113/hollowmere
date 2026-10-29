import type { NextConfig } from "next";

// GitHub Pages serves the project site from /<repo>, so assets need a prefix.
// Set NEXT_PUBLIC_BASE_PATH="" to build for a root-hosted deploy.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
