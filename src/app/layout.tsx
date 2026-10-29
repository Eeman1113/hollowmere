import type { Metadata } from "next";
import "./globals.css";

// Inlined so the icon resolves from any path — itch.io serves the build from
// an opaque subdirectory where a root-relative /favicon.ico would 404.
const ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E" +
  "%3Crect width='32' height='32' fill='%230b0d13'/%3E" +
  "%3Crect x='14' y='7' width='4' height='3' fill='%23b79149'/%3E" +
  "%3Crect x='11' y='10' width='10' height='13' fill='%231b1a26'/%3E" +
  "%3Crect x='13' y='12' width='6' height='9' fill='%23ff9a3c'/%3E" +
  "%3Crect x='15' y='14' width='2' height='5' fill='%23ffd98a'/%3E" +
  "%3Crect x='10' y='23' width='12' height='2' fill='%23b79149'/%3E%3C/svg%3E";

export const metadata: Metadata = {
  title: "Hollowmere — an isometric soulslike",
  description:
    "An infinite, seed-generated isometric soulslike. Every sprite, tile and sound is produced in code.",
  icons: { icon: ICON },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
