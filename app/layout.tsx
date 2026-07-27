import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileHeader } from "@/components/layout/MobileHeader";

export const metadata: Metadata = {
  title: "Finanças Pessoais",
  description: "Gestão financeira pessoal",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Finanças",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <MobileHeader />
          <div className="flex h-screen overflow-hidden bg-background pt-14 md:pt-0">
            <Sidebar />
            <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
