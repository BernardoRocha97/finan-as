"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn, formatCurrency } from "@/lib/utils";
import {
  LayoutDashboard, Landmark, TrendingUp, Home, ArrowLeftRight,
  Upload, Target, BarChart3, Settings, Sun, Moon, CalendarRange, Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/gestao-mensal", label: "Gestão Mensal", icon: CalendarRange },
  { href: "/contas", label: "Contas", icon: Landmark },
  { href: "/investimentos", label: "Investimentos", icon: TrendingUp },
  { href: "/imoveis", label: "Imóveis", icon: Home },
  { href: "/transacoes", label: "Transações", icon: ArrowLeftRight },
  { href: "/importar", label: "Importar", icon: Upload },
  { href: "/orcamento", label: "Orçamento", icon: Wallet },
  { href: "/objetivos", label: "Objetivos", icon: Target },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

const mobileNav = [
  { href: "/dashboard", label: "Início", icon: LayoutDashboard },
  { href: "/transacoes", label: "Transações", icon: ArrowLeftRight },
  { href: "/contas", label: "Contas", icon: Landmark },
  { href: "/investimentos", label: "Investir", icon: TrendingUp },
  { href: "/importar", label: "Importar", icon: Upload },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [netWorth, setNetWorth] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    fetch("/api/relatorios/patrimonio")
      .then((r) => r.json())
      .then((d) => setNetWorth(d.data?.netWorth ?? 0))
      .catch(() => {});
  }, []);

  return (
    <>
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-60 flex-col border-r bg-card h-full shrink-0">
        <div className="p-4 border-b">
          <span className="font-bold text-lg tracking-tight">Finanças</span>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                pathname.startsWith(href)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t space-y-2">
          {netWorth !== null && (
            <div className="text-xs text-muted-foreground">
              <div>Net Worth</div>
              <div className={cn("font-semibold text-sm", netWorth >= 0 ? "text-green-600" : "text-red-500")}>
                {formatCurrency(netWorth)}
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            suppressHydrationWarning
          >
            {mounted ? (
              theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
            {mounted ? (theme === "dark" ? "Modo claro" : "Modo escuro") : "Modo escuro"}
          </Button>
        </div>
      </aside>

      {/* Bottom nav móvel */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur border-t flex items-stretch" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {mobileNav.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors"
            >
              <div className={cn(
                "rounded-xl px-3 py-1 transition-all",
                active ? "bg-primary/10" : ""
              )}>
                <Icon className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")} />
              </div>
              <span className={cn("text-[10px] font-medium", active ? "text-primary" : "text-muted-foreground")}>
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
