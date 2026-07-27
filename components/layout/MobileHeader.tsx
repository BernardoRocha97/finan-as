"use client";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import Link from "next/link";
import {
  LayoutDashboard, Landmark, TrendingUp, Home, ArrowLeftRight,
  Upload, Target, BarChart3, Settings, CalendarRange, Wallet, LogOut,
} from "lucide-react";
import { signOut } from "next-auth/react";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/gestao-mensal", label: "Gestão Mensal", icon: CalendarRange },
  { href: "/contas", label: "Contas", icon: Landmark },
  { href: "/transacoes", label: "Transações", icon: ArrowLeftRight },
  { href: "/importar", label: "Importar", icon: Upload },
  { href: "/investimentos", label: "Investimentos", icon: TrendingUp },
  { href: "/imoveis", label: "Imóveis", icon: Home },
  { href: "/orcamento", label: "Orçamento", icon: Wallet },
  { href: "/objetivos", label: "Objetivos", icon: Target },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

const titles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/gestao-mensal": "Gestão Mensal",
  "/contas": "Contas",
  "/transacoes": "Transações",
  "/importar": "Importar",
  "/investimentos": "Investimentos",
  "/imoveis": "Imóveis",
  "/orcamento": "Orçamento",
  "/objetivos": "Objetivos",
  "/relatorios": "Relatórios",
  "/configuracoes": "Configurações",
};

export function MobileHeader() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  const title = Object.entries(titles).find(([k]) => pathname.startsWith(k))?.[1] ?? "Finanças";

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-card border-b flex items-center px-4 gap-3">
      {/* Menu lateral */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button className="p-1.5 rounded-lg hover:bg-accent transition-colors">
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <div className="p-5 border-b">
            <span className="font-bold text-lg">Finanças Pessoais</span>
          </div>
          <nav className="p-3 space-y-0.5 flex-1 overflow-y-auto">
            {nav.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors",
                  pathname.startsWith(href)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="p-3 border-t">
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 w-full transition-colors"
            >
              <LogOut className="h-5 w-5" />
              Terminar sessão
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Título da página */}
      <span className="font-semibold text-base flex-1">{title}</span>

      {/* Toggle tema */}
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="p-1.5 rounded-lg hover:bg-accent transition-colors"
        suppressHydrationWarning
      >
        {mounted ? (
          theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />
        ) : (
          <Moon className="h-5 w-5" />
        )}
      </button>
    </header>
  );
}
