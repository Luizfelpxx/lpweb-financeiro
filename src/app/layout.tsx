import type { Metadata, Viewport } from "next";
import RegistrarSW from "@/components/RegistrarSW";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "LPweb.dev | Assessoria Financeira",
    template: "%s • LPweb.dev",
  },
  description: "Controle de empréstimos a clientes — LPweb.dev | Assessoria Financeira",
  applicationName: "LPweb.dev",
  appleWebApp: { capable: true, title: "LPweb.dev", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1E3A5F" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1B2D" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh antialiased">
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
