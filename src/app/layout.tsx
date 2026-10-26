import type { Metadata, Viewport } from "next";
import { idiomaActual } from "@/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "acts",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const idioma = await idiomaActual();
  return (
    <html lang={idioma}>
      <body>{children}</body>
    </html>
  );
}
