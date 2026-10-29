import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hollowmere — Isometric Survival RPG",
  description: "An isometric survival RPG built with Phaser 4 and Next.js.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
