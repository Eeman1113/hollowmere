import type { NextConfig } from "next";

// Two deploy shapes:
//  - GitHub Pages serves from /<repo>, so assets need that prefix.
//  - itch.io serves the zip from an opaque path, so assets must be relative.
// NEXT_PUBLIC_ASSET_MODE=relative switches to the itch.io shape.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const relative = process.env.NEXT_PUBLIC_ASSET_MODE === "relative";

const nextConfig: NextConfig = {
  output: "export",
  basePath: relative ? "" : basePath,
  assetPrefix: relative ? "." : basePath || undefined,
  images: { unoptimized: true },
  trailingSlash: !relative,
};

export default nextConfig;
