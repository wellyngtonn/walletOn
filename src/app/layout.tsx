import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { MobileZoomLock } from "@/components/mobile-zoom-lock";
export const metadata: Metadata = {
  title: { default: "WalletON", template: "%s | WalletON" },
  description: "Sua vida financeira, simples e organizada.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};
export const viewport: Viewport = {
  themeColor: "#15b985",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className="scrollbar-none">
      <body>
        <MobileZoomLock />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
