"use client";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Menu, X, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  LayoutDashboard, Landmark, TrendingUp, Home, ArrowLeftRight,
  Upload, Target, BarChart3, Settings, CalendarRange, Wallet,
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

  // Fechar drawer ao navegar
  useEffect(() => { setOpen(false); }, [pathname]);

  const title = Object.entries(titles).find(([k]) => pathname.startsWith(k))?.[1] ?? "Finanças";

  return (
    <>
      {/* Header fixo */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-card/95 backdrop-blur border-b flex items-center px-4 gap-3">
        <button
          onClick={() => setOpen(true)}
          className="p-1.5 rounded-lg hover:bg-accent transition-colors"
          aria-label="Menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <span className="font-semibold text-base flex-1 truncate">{title}</span>

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

      {/* Overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer lateral */}
      <div className={cn(
        "md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 bg-card flex flex-col transition-transform duration-300 ease-in-out",
        open ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-14 flex items-center justify-between px-5 border-b shrink-0">
          <span className="font-bold text-base">Finanças Pessoais</span>
          <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
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

        <div className="p-3 border-t shrink-0" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 w-full transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Terminar sessão
          </button>
        </div>
      </div>
    </>
  );
}
