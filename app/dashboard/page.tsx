"use client";
import { useEffect, useState, useMemo } from "react";
import { formatCurrency, formatDate, toNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, ReferenceLine,
} from "recharts";
import {
  TrendingUp, TrendingDown, Wallet, PiggyBank, Target, AlertCircle,
  ArrowUpRight, ArrowDownRight, Minus, Building2, LineChart, RefreshCw,
  ChevronRight, CreditCard, Banknote, Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { pt } from "date-fns/locale";

// ── helpers ─────────────────────────────────────────────────────────────────

function DeltaBadge({ value, inverted = false }: { value: number; inverted?: boolean }) {
  const positive = inverted ? value < 0 : value > 0;
  const zero = value === 0;
  if (zero) return <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Minus className="h-3 w-3" />igual</span>;
  return (
    <span className={cn("text-xs flex items-center gap-0.5 font-medium", positive ? "text-emerald-500" : "text-red-500")}>
      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {formatCurrency(Math.abs(value))}
    </span>
  );
}

function KpiCard({
  label, value, sub, icon: Icon, color = "blue", delta, deltaInverted = false, href,
}: {
  label: string; value: string; sub?: string; icon: any; color?: string;
  delta?: number; deltaInverted?: boolean; href?: string;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-500",
    green: "bg-emerald-500/10 text-emerald-500",
    red: "bg-red-500/10 text-red-500",
    violet: "bg-violet-500/10 text-violet-500",
    amber: "bg-amber-500/10 text-amber-500",
  };
  const inner = (
    <Card className="hover:shadow-md transition-shadow cursor-default">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">{label}</p>
            <p className="text-2xl font-bold truncate">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
            {delta !== undefined && (
              <div className="mt-2">
                <DeltaBadge value={delta} inverted={deltaInverted} />
                <span className="text-xs text-muted-foreground ml-1">vs mês ant.</span>
              </div>
            )}
          </div>
          <div className={cn("p-2.5 rounded-xl shrink-0 ml-3", colors[color])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

// Custom Tooltip for area chart
const CashflowTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const rec = payload.find((p: any) => p.dataKey === "receitas")?.value ?? 0;
  const dep = payload.find((p: any) => p.dataKey === "despesas")?.value ?? 0;
  const saldo = rec - dep;
  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 text-sm min-w-[160px]">
      <p className="font-semibold mb-2">{label}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4"><span className="text-emerald-500">Receitas</span><span className="font-medium">{formatCurrency(rec)}</span></div>
        <div className="flex justify-between gap-4"><span className="text-red-500">Despesas</span><span className="font-medium">{formatCurrency(dep)}</span></div>
        <div className="border-t pt-1 mt-1 flex justify-between gap-4">
          <span className="text-muted-foreground">Saldo</span>
          <span className={cn("font-bold", saldo >= 0 ? "text-emerald-500" : "text-red-500")}>{formatCurrency(saldo)}</span>
        </div>
      </div>
    </div>
  );
};

const CatTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold">{d.name}</p>
      <p className="text-muted-foreground">{formatCurrency(d.value)}</p>
      <p className="text-xs text-muted-foreground">{((d.payload.percent ?? 0) * 100).toFixed(1)}%</p>
    </div>
  );
};

// ── main component ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [patrimonio, setPatrimonio] = useState<any>(null);
  const [mensal, setMensal] = useState<any[]>([]);
  const [porCategoria, setPorCategoria] = useState<any[]>([]);
  const [ultimasTransacoes, setUltimasTransacoes] = useState<any[]>([]);
  const [objetivos, setObjetivos] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);
  const [imoveis, setImoveis] = useState<any[]>([]);
  const [naoRevisadas, setNaoRevisadas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = () => {
    setLoading(true);
    const now = new Date();
    const mesIni = startOfMonth(now).toISOString();
    const mesFim = endOfMonth(now).toISOString();
    Promise.all([
      fetch("/api/relatorios/patrimonio").then((r) => r.json()),
      fetch("/api/transacoes/resumo-mensal").then((r) => r.json()),
      fetch(`/api/transacoes/por-categoria?inicio=${mesIni}&fim=${mesFim}`).then((r) => r.json()),
      fetch("/api/transacoes?limite=10").then((r) => r.json()),
      fetch("/api/objetivos").then((r) => r.json()),
      fetch("/api/contas/resumo").then((r) => r.json()),
      fetch("/api/transacoes?naoRevisadas=1&limite=1").then((r) => r.json()),
      fetch("/api/imoveis").then((r) => r.json()),
    ]).then(([pat, men, cat, trans, obj, cnt, nr, imov]) => {
      setPatrimonio(pat.data);
      setMensal(men.data ?? []);
      setPorCategoria(cat.data ?? []);
      setUltimasTransacoes(trans.data ?? []);
      setObjetivos(obj.data ?? []);
      setContas(cnt.data?.contas ?? []);
      setImoveis(imov.data ?? []);
      setNaoRevisadas(nr.total ?? 0);
      setLastRefresh(new Date());
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const mesAtual = mensal[mensal.length - 1];
  const mesAnterior = mensal[mensal.length - 2];
  const taxaPoupanca = mesAtual?.receitas > 0
    ? ((mesAtual.receitas - mesAtual.despesas) / mesAtual.receitas) * 100
    : 0;
  const taxaAnterior = mesAnterior?.receitas > 0
    ? ((mesAnterior.receitas - mesAnterior.despesas) / mesAnterior.receitas) * 100
    : 0;

  // build chart data with saldo line
  const chartData = useMemo(() => mensal.map((m) => ({
    ...m,
    saldo: m.receitas - m.despesas,
  })), [mensal]);

  // top 3 despesas do mês
  const top3 = porCategoria.slice(0, 3);
  const totalDespesasMes = porCategoria.reduce((s, c) => s + c.valor, 0);

  const objetivosPoupanca = objetivos.filter((o) => o.tipo === "POUPANCA");
  const orcamentos = objetivos.filter((o) => o.tipo === "ORCAMENTO_MENSAL");

  const mesLabel = format(new Date(), "MMMM yyyy", { locale: pt });

  // ── Fundo de emergência ────────────────────────────────────────────────────
  const totalLiquidez = contas
    .filter((c: any) => c.tipo !== "INVESTIMENTO")
    .reduce((s: number, c: any) => s + toNumber(c.saldo), 0);
  const ultimos12m = mensal.slice(-12);
  const avgDespesas3m = ultimos12m.length > 0
    ? ultimos12m.reduce((s, m) => s + m.despesas, 0) / ultimos12m.length
    : 0;
  const mesesEmergencia = avgDespesas3m > 0 ? totalLiquidez / avgDespesas3m : 0;
  const metaEmergencia = 6;
  const pctEmergencia = Math.min(100, (mesesEmergencia / metaEmergencia) * 100);

  // ── Score de saúde financeira (0-100) ─────────────────────────────────────
  const scorePoupanca = Math.round(Math.min(25, (taxaPoupanca / 20) * 25));
  const scoreEmergencia = Math.round(Math.min(25, (mesesEmergencia / metaEmergencia) * 25));
  const totalAtivos = toNumber(patrimonio?.totalAtivos ?? 0);
  const totalPassivos = toNumber(patrimonio?.totalPassivos ?? 0);
  const nClassesAtivos = [
    (patrimonio?.contas ?? []).reduce((s: number, c: any) => s + c.saldo, 0),
    (patrimonio?.investimentos ?? []).reduce((s: number, i: any) => s + i.valor, 0),
    (patrimonio?.imoveis ?? []).reduce((s: number, p: any) => s + p.equity, 0),
  ].filter((v) => v > 0).length;
  const scoreDiversificacao = nClassesAtivos >= 3 ? 25 : nClassesAtivos === 2 ? 15 : nClassesAtivos === 1 ? 5 : 0;
  const ratioPassivos = totalAtivos > 0 ? totalPassivos / totalAtivos : 0;
  const scoreDivida = Math.round(Math.max(0, (1 - ratioPassivos / 0.4) * 25));
  const scoreTotal = Math.min(100, scorePoupanca + scoreEmergencia + scoreDiversificacao + scoreDivida);
  const scoreColor = scoreTotal >= 75 ? "text-emerald-500" : scoreTotal >= 50 ? "text-amber-500" : "text-red-500";
  const scoreBg = scoreTotal >= 75 ? "bg-emerald-500" : scoreTotal >= 50 ? "bg-amber-500" : "bg-red-500";
  const scoreLabel = scoreTotal >= 75 ? "Boa" : scoreTotal >= 50 ? "Razoável" : "A melhorar";

  // ── Próximos eventos ───────────────────────────────────────────────────────
  const hoje = new Date();
  type Evento = { data: Date; label: string; tipo: "hipoteca" | "objetivo" | "orcamento"; valor?: number };
  const eventos: Evento[] = [];

  // Próximo pagamento de hipoteca (dia 1 do próximo mês para cada imóvel)
  for (const im of imoveis) {
    if (im.hipoteca && toNumber(im.hipoteca.capitalEmDivida) > 0) {
      const proxData = new Date(hoje.getFullYear(), hoje.getMonth() + (hoje.getDate() > 20 ? 1 : 0) + 1, 1);
      eventos.push({
        data: proxData,
        label: `Hipoteca · ${im.nome}`,
        tipo: "hipoteca",
        valor: toNumber(im.hipoteca.prestacaoMensal),
      });
    }
  }

  // Objetivos com data limite nos próximos 180 dias
  for (const obj of objetivosPoupanca) {
    if (obj.dataLimite) {
      const d = new Date(obj.dataLimite);
      const diff = (d.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24);
      if (diff >= 0 && diff <= 180) {
        eventos.push({ data: d, label: `Objetivo · ${obj.nome}`, tipo: "objetivo", valor: toNumber(obj.valorAlvo) - toNumber(obj.valorAtual) });
      }
    }
  }

  eventos.sort((a, b) => a.data.getTime() - b.data.getTime());
  const proximosEventos = eventos.slice(0, 5);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold capitalize">{mesLabel}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Atualizado às {format(lastRefresh, "HH:mm")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {/* ── Alert ──────────────────────────────────────────────── */}
      {naoRevisadas > 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{naoRevisadas} transação(ões) por rever.</span>
          <Link href="/transacoes?naoRevisadas=1" className="underline font-medium ml-1 hover:no-underline">
            Rever agora →
          </Link>
        </div>
      )}

      {/* ── KPIs ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <KpiCard
          label="Património líquido"
          value={formatCurrency(toNumber(patrimonio?.netWorth))}
          icon={Wallet}
          color="blue"
          href="/relatorios"
        />
        <KpiCard
          label="Receitas do mês"
          value={formatCurrency(toNumber(mesAtual?.receitas))}
          delta={mesAnterior ? toNumber(mesAtual?.receitas) - toNumber(mesAnterior?.receitas) : undefined}
          icon={TrendingUp}
          color="green"
        />
        <KpiCard
          label="Despesas do mês"
          value={formatCurrency(toNumber(mesAtual?.despesas))}
          delta={mesAnterior ? toNumber(mesAtual?.despesas) - toNumber(mesAnterior?.despesas) : undefined}
          deltaInverted
          icon={TrendingDown}
          color="red"
        />
        <KpiCard
          label="Saldo do mês"
          value={formatCurrency(toNumber(mesAtual?.saldo))}
          delta={mesAnterior ? toNumber(mesAtual?.saldo) - toNumber(mesAnterior?.saldo) : undefined}
          icon={mesAtual?.saldo >= 0 ? ArrowUpRight : ArrowDownRight}
          color={mesAtual?.saldo >= 0 ? "green" : "red"}
        />
        <KpiCard
          label="Taxa de poupança"
          value={`${taxaPoupanca.toFixed(1)}%`}
          delta={taxaAnterior ? taxaPoupanca - taxaAnterior : undefined}
          sub={`Meta: >20%`}
          icon={PiggyBank}
          color={taxaPoupanca >= 20 ? "green" : taxaPoupanca >= 10 ? "amber" : "red"}
        />
      </div>

      {/* ── Score de saúde financeira ──────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-6 flex-wrap">
            {/* Score principal */}
            <div className="flex items-center gap-4 shrink-0">
              <div className="relative h-16 w-16">
                <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="3"
                    className={scoreBg.replace("bg-", "stroke-")}
                    strokeDasharray={`${scoreTotal} 100`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={cn("text-lg font-bold", scoreColor)}>{scoreTotal}</span>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Saúde financeira</p>
                <p className={cn("text-xl font-bold", scoreColor)}>{scoreLabel}</p>
              </div>
            </div>

            {/* Sub-scores */}
            <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-3 min-w-0">
              {[
                { label: "Taxa de poupança", pts: scorePoupanca, max: 25, tip: `${taxaPoupanca.toFixed(1)}% (meta 20%)` },
                { label: "Fundo emergência", pts: scoreEmergencia, max: 25, tip: `${mesesEmergencia.toFixed(1)} meses (meta 6)` },
                { label: "Diversificação", pts: scoreDiversificacao, max: 25, tip: `${nClassesAtivos} classe${nClassesAtivos !== 1 ? "s" : ""} de ativos` },
                { label: "Nível de dívida", pts: scoreDivida, max: 25, tip: `${(ratioPassivos * 100).toFixed(0)}% dos ativos` },
              ].map((s) => (
                <div key={s.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground truncate">{s.label}</span>
                    <span className={cn("font-semibold ml-1 shrink-0",
                      s.pts >= s.max * 0.8 ? "text-emerald-500" : s.pts >= s.max * 0.5 ? "text-amber-500" : "text-red-500")}>
                      {s.pts}/{s.max}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={cn("h-full rounded-full",
                      s.pts >= s.max * 0.8 ? "bg-emerald-500" : s.pts >= s.max * 0.5 ? "bg-amber-500" : "bg-red-500")}
                      style={{ width: `${(s.pts / s.max) * 100}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">{s.tip}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Main grid ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Left — chart 2/3 */}
        <div className="xl:col-span-2 space-y-6">

          {/* Cashflow chart */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Receitas vs Despesas — 12 meses</CardTitle>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />Receitas</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 inline-block" />Despesas</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />Saldo</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CashflowTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" />
                  <Bar dataKey="receitas" name="Receitas" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>

              {/* Saldo mini-line below */}
              <div className="mt-2 border-t pt-4">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Saldo mensal</p>
                <ResponsiveContainer width="100%" height={60}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="saldoGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="mes" hide />
                    <YAxis hide />
                    <Tooltip formatter={(v: any) => formatCurrency(v)} labelFormatter={(l) => l} />
                    <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                    <Area type="monotone" dataKey="saldo" stroke="#3b82f6" strokeWidth={2} fill="url(#saldoGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Bottom row: categories pie + transactions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Despesas por categoria */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Despesas por categoria</CardTitle>
                  <Badge variant="outline" className="text-xs">{format(new Date(), "MMM", { locale: pt })}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {porCategoria.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sem despesas este mês</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={porCategoria}
                          dataKey="valor"
                          nameKey="nome"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                        >
                          {porCategoria.map((c, i) => (
                            <Cell key={i} fill={c.cor} />
                          ))}
                        </Pie>
                        <Tooltip content={<CatTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1.5 mt-2">
                      {porCategoria.slice(0, 6).map((c) => (
                        <div key={c.nome} className="flex items-center gap-2 text-sm">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: c.cor }} />
                          <span className="flex-1 truncate text-muted-foreground">{c.nome}</span>
                          <span className="font-medium">{formatCurrency(c.valor)}</span>
                          <span className="text-xs text-muted-foreground w-9 text-right">
                            {totalDespesasMes > 0 ? ((c.valor / totalDespesasMes) * 100).toFixed(0) : 0}%
                          </span>
                        </div>
                      ))}
                      {porCategoria.length > 6 && (
                        <p className="text-xs text-muted-foreground text-center pt-1">
                          +{porCategoria.length - 6} categorias
                        </p>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Últimas transações */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Transações recentes</CardTitle>
                  <Link href="/transacoes">
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                      Ver todas <ChevronRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {ultimasTransacoes.length === 0 && (
                    <p className="text-sm text-muted-foreground px-6 py-4">Sem transações</p>
                  )}
                  {ultimasTransacoes.map((t: any) => (
                    <div key={t.id} className="flex items-center gap-3 px-6 py-2.5 hover:bg-muted/40 transition-colors">
                      <div
                        className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                        style={{ backgroundColor: t.category?.cor ?? "#6b7280", color: "#fff" }}
                      >
                        {(t.category?.nome ?? "?")[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate font-medium">{t.descricao}</p>
                        <p className="text-xs text-muted-foreground">{t.category?.nome ?? "Outros"} · {formatDate(t.data)}</p>
                      </div>
                      <span className={cn("text-sm font-semibold shrink-0", t.tipo === "RECEITA" ? "text-emerald-500" : "text-red-500")}>
                        {t.tipo === "RECEITA" ? "+" : "-"}{formatCurrency(toNumber(t.valor))}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right column 1/3 */}
        <div className="space-y-5">

          {/* Contas */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Contas
                </CardTitle>
                <Link href="/contas">
                  <Button variant="ghost" size="sm" className="h-7 text-xs"><Eye className="h-3 w-3 mr-1" />Ver</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {contas.map((c: any) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: c.cor ?? "#3b82f6" }}>
                      {c.nome[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{c.nome}</p>
                      <p className="text-xs text-muted-foreground capitalize">{c.tipo?.toLowerCase()}</p>
                    </div>
                  </div>
                  <span className={cn("text-sm font-bold", toNumber(c.saldo) >= 0 ? "text-emerald-500" : "text-red-500")}>
                    {formatCurrency(toNumber(c.saldo))}
                  </span>
                </div>
              ))}
              {contas.length === 0 && <p className="text-sm text-muted-foreground">Sem contas</p>}
            </CardContent>
          </Card>

          {/* Fundo de emergência */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <PiggyBank className="h-4 w-4 text-amber-500" />
                Fundo de emergência
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-end justify-between">
                <div>
                  <p className={cn("text-2xl font-bold",
                    mesesEmergencia >= 6 ? "text-emerald-500" : mesesEmergencia >= 3 ? "text-amber-500" : "text-red-500")}>
                    {mesesEmergencia.toFixed(1)} meses
                  </p>
                  <p className="text-xs text-muted-foreground">de despesas cobertas</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatCurrency(totalLiquidez)}</p>
                  <p className="text-xs text-muted-foreground">liquidez disponível</p>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{mesesEmergencia.toFixed(1)}m de {metaEmergencia}m</span>
                  <span>{pctEmergencia.toFixed(0)}%</span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  {/* 3 zonas: vermelho 0-3m, amarelo 3-6m, verde 6m+ */}
                  <div className="h-full flex">
                    <div className="h-full bg-red-400" style={{ width: `${Math.min(50, pctEmergencia)}%` }} />
                    {pctEmergencia > 50 && <div className="h-full bg-amber-400" style={{ width: `${Math.min(50, pctEmergencia - 50)}%` }} />}
                    {pctEmergencia >= 100 && <div className="h-full bg-emerald-400 flex-1" />}
                  </div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0m</span><span className="text-amber-600">3m</span><span className="text-emerald-600">6m ✓</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Despesas médias: {formatCurrency(avgDespesas3m)}/mês (últ. 12 meses)</p>
            </CardContent>
          </Card>

          {/* Próximos eventos */}
          {proximosEventos.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-blue-500" />
                  Próximos eventos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {proximosEventos.map((ev, i) => {
                  const diasRestantes = Math.ceil((ev.data.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
                  const urgente = diasRestantes <= 7;
                  const breve = diasRestantes <= 30;
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <div className={cn("mt-0.5 h-2 w-2 rounded-full shrink-0",
                        urgente ? "bg-red-500" : breve ? "bg-amber-500" : "bg-blue-400")} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{ev.label}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {format(ev.data, "d MMM yyyy", { locale: pt })}
                          </span>
                          <span className={cn("text-xs font-medium",
                            urgente ? "text-red-500" : breve ? "text-amber-500" : "text-muted-foreground")}>
                            {diasRestantes === 0 ? "hoje" : `em ${diasRestantes}d`}
                          </span>
                        </div>
                      </div>
                      {ev.valor !== undefined && (
                        <span className="text-sm font-semibold shrink-0">{formatCurrency(ev.valor)}</span>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Resumo do mês — comparação */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Resumo do mês</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Taxa poupança progress */}
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">Taxa de poupança</span>
                  <span className={cn("font-bold", taxaPoupanca >= 20 ? "text-emerald-500" : taxaPoupanca >= 10 ? "text-amber-500" : "text-red-500")}>
                    {taxaPoupanca.toFixed(1)}%
                  </span>
                </div>
                <Progress value={Math.min(taxaPoupanca, 100)} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">Meta: 20% · {taxaPoupanca >= 20 ? "✓ Atingida" : `Faltam ${(20 - taxaPoupanca).toFixed(1)} pp`}</p>
              </div>

              {/* Vs mês anterior */}
              {mesAnterior && (
                <div className="border rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">vs mês anterior</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Receitas</p>
                      <DeltaBadge value={toNumber(mesAtual?.receitas) - toNumber(mesAnterior?.receitas)} />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Despesas</p>
                      <DeltaBadge value={toNumber(mesAtual?.despesas) - toNumber(mesAnterior?.despesas)} inverted />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Saldo</p>
                      <DeltaBadge value={toNumber(mesAtual?.saldo) - toNumber(mesAnterior?.saldo)} />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Poupança</p>
                      <DeltaBadge value={taxaPoupanca - taxaAnterior} />
                    </div>
                  </div>
                </div>
              )}

              {/* Top categorias */}
              {top3.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Top despesas</p>
                  <div className="space-y-2">
                    {top3.map((c, i) => (
                      <div key={c.nome} className="flex items-center gap-2 text-sm">
                        <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: c.cor }} />
                        <span className="flex-1 truncate">{c.nome}</span>
                        <span className="font-medium">{formatCurrency(c.valor)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Objetivos */}
          {objetivosPoupanca.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Objetivos
                  </CardTitle>
                  <Link href="/objetivos">
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                      Todos <ChevronRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {objetivosPoupanca.slice(0, 3).map((obj: any) => {
                  const atual = toNumber(obj.valorAtual);
                  const alvo = toNumber(obj.valorAlvo);
                  const pct = alvo > 0 ? Math.min(100, (atual / alvo) * 100) : 0;
                  return (
                    <div key={obj.id} className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium truncate">{obj.nome}</span>
                        <span className="text-muted-foreground text-xs ml-2 shrink-0">{pct.toFixed(0)}%</span>
                      </div>
                      <Progress value={pct} className="h-1.5" style={{ "--progress-color": obj.cor } as any} />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{formatCurrency(atual)}</span>
                        <span>{formatCurrency(alvo)}</span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Orçamentos do mês */}
          {orcamentos.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Banknote className="h-4 w-4" />
                  Orçamentos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {orcamentos.slice(0, 4).map((obj: any) => {
                  const atual = toNumber(obj.valorAtual);
                  const alvo = toNumber(obj.valorAlvo);
                  const pct = alvo > 0 ? Math.min(100, (atual / alvo) * 100) : 0;
                  const over = pct >= 100;
                  return (
                    <div key={obj.id} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{obj.nome}</span>
                        <span className={cn("text-xs font-medium", over ? "text-red-500" : "text-muted-foreground")}>
                          {formatCurrency(atual)} / {formatCurrency(alvo)}
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", over ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-emerald-500")}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Atalhos */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Acesso rápido</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {[
                { href: "/transacoes", label: "Transações", icon: CreditCard },
                { href: "/importar", label: "Importar CSV", icon: ArrowUpRight },
                { href: "/investimentos", label: "Investimentos", icon: LineChart },
                { href: "/imoveis", label: "Imóveis", icon: Building2 },
                { href: "/objetivos", label: "Objetivos", icon: Target },
                { href: "/relatorios", label: "Relatórios", icon: TrendingUp },
              ].map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href}>
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs h-9">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </Button>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
