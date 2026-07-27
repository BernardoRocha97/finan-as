"use client";
import { useEffect, useState, useCallback } from "react";
import { formatCurrency, toNumber, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  Line, PieChart, Pie, Cell, AreaChart, Area, ReferenceLine, ComposedChart,
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear, subYears, getYear, getMonth, addMonths, differenceInCalendarMonths } from "date-fns";
import { pt } from "date-fns/locale";
import { Calendar, Wallet, Home, BarChart3, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

const CORES = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#84cc16","#ec4899","#14b8a6"];
const MESES_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const ANOS = Array.from({ length: 6 }, (_, i) => getYear(new Date()) - 3 + i);

// ── Period selector ───────────────────────────────────────────────────────────

type Preset = "3m" | "6m" | "12m" | "24m" | "year" | "lastyear" | "custom";
interface Period { inicio: Date; fim: Date }

function PeriodSelector({ onChange }: { onChange: (p: Period) => void }) {
  const [preset, setPreset] = useState<Preset>("12m");
  const [customStart, setCustomStart] = useState({ mes: 0, ano: getYear(new Date()) - 1 });
  const [customEnd, setCustomEnd] = useState({ mes: getMonth(new Date()), ano: getYear(new Date()) });
  const [showCustom, setShowCustom] = useState(false);
  const [label, setLabel] = useState("");

  const applyPreset = useCallback((p: Preset) => {
    setPreset(p);
    const hoje = new Date();
    let periodo: Period | null = null;
    if (p === "3m")       periodo = { inicio: startOfMonth(subMonths(hoje, 2)), fim: endOfMonth(hoje) };
    else if (p === "6m")  periodo = { inicio: startOfMonth(subMonths(hoje, 5)), fim: endOfMonth(hoje) };
    else if (p === "12m") periodo = { inicio: startOfMonth(subMonths(hoje, 11)), fim: endOfMonth(hoje) };
    else if (p === "24m") periodo = { inicio: startOfMonth(subMonths(hoje, 23)), fim: endOfMonth(hoje) };
    else if (p === "year") periodo = { inicio: startOfYear(hoje), fim: endOfMonth(hoje) };
    else if (p === "lastyear") periodo = { inicio: startOfYear(subYears(hoje, 1)), fim: endOfYear(subYears(hoje, 1)) };

    if (periodo) {
      setLabel(`${format(periodo.inicio, "MMM yyyy", { locale: pt })} – ${format(periodo.fim, "MMM yyyy", { locale: pt })}`);
      onChange(periodo);
      setShowCustom(false);
    } else {
      setShowCustom(true);
    }
  }, [onChange]);

  useEffect(() => { applyPreset("12m"); }, []); // eslint-disable-line

  const applyCustom = () => {
    const inicio = startOfMonth(new Date(customStart.ano, customStart.mes, 1));
    const fim = endOfMonth(new Date(customEnd.ano, customEnd.mes, 1));
    if (fim < inicio) return;
    setLabel(`${format(inicio, "MMM yyyy", { locale: pt })} – ${format(fim, "MMM yyyy", { locale: pt })}`);
    onChange({ inicio, fim });
  };

  const PRESETS: { key: Preset; label: string }[] = [
    { key: "3m", label: "3 meses" },
    { key: "6m", label: "6 meses" },
    { key: "12m", label: "12 meses" },
    { key: "24m", label: "24 meses" },
    { key: "year", label: "Este ano" },
    { key: "lastyear", label: "Ano passado" },
    { key: "custom", label: "Personalizado" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button key={p.key} onClick={() => applyPreset(p.key)}
              className={cn("text-xs px-3 py-1.5 rounded-full border transition-colors font-medium",
                preset === p.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-muted text-muted-foreground")}>
              {p.label}
            </button>
          ))}
        </div>
        {label && <span className="text-xs text-muted-foreground">{label}</span>}
      </div>

      {showCustom && (
        <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg border bg-muted/40">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground font-medium">De</span>
            <div className="flex gap-1">
              <select value={customStart.mes} onChange={(e) => setCustomStart((s) => ({ ...s, mes: Number(e.target.value) }))}
                className="text-xs border rounded px-2 py-1.5 bg-background">
                {MESES_PT.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select value={customStart.ano} onChange={(e) => setCustomStart((s) => ({ ...s, ano: Number(e.target.value) }))}
                className="text-xs border rounded px-2 py-1.5 bg-background">
                {ANOS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground font-medium">Até</span>
            <div className="flex gap-1">
              <select value={customEnd.mes} onChange={(e) => setCustomEnd((s) => ({ ...s, mes: Number(e.target.value) }))}
                className="text-xs border rounded px-2 py-1.5 bg-background">
                {MESES_PT.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select value={customEnd.ano} onChange={(e) => setCustomEnd((s) => ({ ...s, ano: Number(e.target.value) }))}
                className="text-xs border rounded px-2 py-1.5 bg-background">
                {ANOS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <Button size="sm" onClick={applyCustom} className="h-8">Aplicar</Button>
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Delta({ val, suffix = "%" }: { val: number; suffix?: string }) {
  if (val === 0) return <span className="text-muted-foreground flex items-center gap-0.5 text-xs"><Minus className="h-3 w-3" />0{suffix}</span>;
  return val > 0
    ? <span className="text-emerald-500 flex items-center gap-0.5 text-xs"><ArrowUpRight className="h-3 w-3" />+{val.toFixed(1)}{suffix}</span>
    : <span className="text-red-500 flex items-center gap-0.5 text-xs"><ArrowDownRight className="h-3 w-3" />{val.toFixed(1)}{suffix}</span>;
}

function KpiCard({ label, value, sub, delta, color }: any) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-2xl font-bold mt-1", color)}>{value}</p>
        {(sub || delta !== undefined) && (
          <div className="flex items-center gap-2 mt-1">
            {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
            {delta !== undefined && <Delta val={delta} />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 text-xs space-y-1 min-w-[160px]">
      <p className="font-medium text-sm mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />{p.name}
          </span>
          <span className="font-semibold">{Math.abs(p.value) > 100 ? formatCurrency(p.value) : `${Number(p.value).toFixed(1)}%`}</span>
        </div>
      ))}
    </div>
  );
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function RelatoriosPage() {
  const [period, setPeriod] = useState<Period | null>(null);
  const [fluxo, setFluxo] = useState<any[]>([]);
  const [netWorth, setNetWorth] = useState<any>(null);
  const [patrimonio, setPatrimonio] = useState<any>(null);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    const inicio = p.inicio.toISOString();
    const fim = p.fim.toISOString();
    const [f, nw, pat, cat] = await Promise.all([
      fetch(`/api/transacoes/resumo-mensal?inicio=${inicio}&fim=${fim}`).then((r) => r.json()),
      fetch("/api/relatorios/net-worth").then((r) => r.json()),
      fetch("/api/relatorios/patrimonio").then((r) => r.json()),
      fetch(`/api/transacoes/por-categoria?inicio=${inicio}&fim=${fim}`).then((r) => r.json()),
    ]);
    setFluxo(f.data ?? []);
    setNetWorth(nw.data);
    setPatrimonio(pat.data);
    setCategorias(cat.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { if (period) load(period); }, [period, load]);

  // ── Derived ──────────────────────────────────────────────────────────────

  const n = fluxo.length || 1;
  const fluxoEnriquecido = fluxo.map((m) => ({
    ...m,
    taxaPoupanca: m.receitas > 0 ? ((m.receitas - m.despesas) / m.receitas) * 100 : 0,
  }));

  const totalReceitas = fluxo.reduce((s, m) => s + m.receitas, 0);
  const totalDespesas = fluxo.reduce((s, m) => s + m.despesas, 0);
  const totalSaldo = totalReceitas - totalDespesas;
  const taxaPoupancaMedia = totalReceitas > 0 ? (totalSaldo / totalReceitas) * 100 : 0;
  const melhorMes = [...fluxo].sort((a, b) => b.saldo - a.saldo)[0];
  const piorMes = [...fluxo].sort((a, b) => a.saldo - b.saldo)[0];

  const historicoNW = (netWorth?.historico ?? []).map((s: any) => ({
    data: format(new Date(s.data), "MMM yy", { locale: pt }),
    netWorth: toNumber(s.netWorth),
    ativos: toNumber(s.totalAtivos),
    passivos: toNumber(s.totalPassivos),
  }));

  // projecoes = [{ label: "conservador"|"base"|"otimista", points: [{ano, valor}] }]
  const scenariosRaw: any[] = netWorth?.projecoes ?? [];
  const getScenario = (label: string) => scenariosRaw.find((s: any) => s.label === label)?.points ?? [];
  const basePoints = getScenario("base");
  const projecaoData = basePoints.map((p: any, i: number) => ({
    ano: String(p.ano),
    conservador: Math.round(getScenario("conservador")[i]?.valor ?? 0),
    base: Math.round(p.valor),
    otimista: Math.round(getScenario("otimista")[i]?.valor ?? 0),
  }));

  const nwAtual = toNumber(netWorth?.atual?.netWorth ?? 0);
  const nwAnterior = historicoNW.length >= 2 ? historicoNW[historicoNW.length - 2]?.netWorth ?? 0 : 0;
  const deltaNW = nwAnterior > 0 ? ((nwAtual - nwAnterior) / nwAnterior) * 100 : 0;
  const nwHaMesAtras = historicoNW.length >= 2 ? nwAnterior : 0;
  const ganhoUltimoMes = nwAtual - nwHaMesAtras;

  const breakdownAtual = netWorth?.atual?.breakdown ?? {};
  const breakdownItems = [
    { nome: "Contas", valor: toNumber(breakdownAtual.totalContas), cor: "#3b82f6" },
    { nome: "Investimentos", valor: toNumber(breakdownAtual.totalInvest), cor: "#10b981" },
    { nome: "Imóveis", valor: toNumber(breakdownAtual.totalImoveis), cor: "#f59e0b" },
    { nome: "Hipotecas", valor: -toNumber(breakdownAtual.totalHipotecas), cor: "#ef4444" },
  ].filter((b) => b.valor !== 0);

  const MILESTONE_VALUES = [50000, 100000, 250000, 500000, 1000000];
  const milestones = MILESTONE_VALUES.map((m) => ({
    valor: m,
    label: m >= 1000000 ? `${m / 1000000}M€` : `${m / 1000}k€`,
    atingido: nwAtual >= m,
    ano: nwAtual < m ? basePoints.find((p: any) => p.valor >= m)?.ano ?? null : null,
  }));

  const ativosBreakdown = patrimonio ? [
    { nome: "Contas bancárias", valor: (patrimonio.contas ?? []).reduce((s: number, c: any) => s + c.saldo, 0), cor: "#3b82f6" },
    { nome: "Investimentos", valor: (patrimonio.investimentos ?? []).reduce((s: number, i: any) => s + i.valor, 0), cor: "#10b981" },
    { nome: "Imóveis (equity)", valor: (patrimonio.imoveis ?? []).reduce((s: number, p: any) => s + p.equity, 0), cor: "#f59e0b" },
  ].filter((a) => a.valor > 0) : [];
  const totalAtivos = ativosBreakdown.reduce((s, a) => s + a.valor, 0);

  const barSize = n > 18 ? 6 : n > 12 ? 10 : 18;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Relatórios</h1>
        {loading && <Badge variant="outline" className="text-xs animate-pulse">A carregar...</Badge>}
      </div>

      <PeriodSelector onChange={setPeriod} />

      {period && (
        <Tabs defaultValue="resumo">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="fluxo">Fluxo de caixa</TabsTrigger>
            <TabsTrigger value="categorias">Categorias</TabsTrigger>
            <TabsTrigger value="patrimonio">Patrimônio</TabsTrigger>
            <TabsTrigger value="networth">Net Worth</TabsTrigger>
          </TabsList>

          {/* ── RESUMO ──────────────────────────────────────────────────── */}
          <TabsContent value="resumo" className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Total receitas" value={formatCurrency(totalReceitas)} sub={`${formatCurrency(totalReceitas / n)}/mês`} color="text-emerald-500" />
              <KpiCard label="Total despesas" value={formatCurrency(totalDespesas)} sub={`${formatCurrency(totalDespesas / n)}/mês`} />
              <KpiCard label="Saldo líquido" value={formatCurrency(totalSaldo)} color={totalSaldo >= 0 ? "text-emerald-500" : "text-red-500"} />
              <KpiCard label="Taxa de poupança" value={`${taxaPoupancaMedia.toFixed(1)}%`} sub="média do período"
                color={taxaPoupancaMedia >= 20 ? "text-emerald-500" : taxaPoupancaMedia >= 10 ? "text-amber-500" : "text-red-500"} />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Net Worth atual" value={formatCurrency(nwAtual)} delta={deltaNW} color="text-blue-500" />
              <KpiCard label="Total ativos" value={formatCurrency(toNumber(patrimonio?.totalAtivos))} color="text-emerald-500" />
              <KpiCard label="Total passivos" value={formatCurrency(toNumber(patrimonio?.totalPassivos))} color="text-red-500" />
              <KpiCard label="Melhor mês" value={melhorMes ? formatCurrency(melhorMes.saldo) : "—"} sub={melhorMes?.mes} color="text-emerald-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Receitas vs Despesas</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={fluxo} barSize={barSize}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                      <XAxis dataKey="mes" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={32} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="receitas" name="Receitas" fill="#10b981" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Taxa de poupança mensal</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={fluxoEnriquecido}>
                      <defs>
                        <linearGradient id="gradPoupanca" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                      <XAxis dataKey="mes" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v.toFixed(0)}%`} width={36} />
                      <Tooltip formatter={(v: any) => `${Number(v).toFixed(1)}%`} />
                      <ReferenceLine y={20} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "20%", fontSize: 10, fill: "#f59e0b" }} />
                      <Area type="monotone" dataKey="taxaPoupanca" name="Taxa poupança" stroke="#10b981" fill="url(#gradPoupanca)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="border-emerald-200 dark:border-emerald-800">
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-emerald-600 font-semibold uppercase mb-2">Melhor mês</p>
                  <p className="text-xl font-bold text-emerald-500">{melhorMes ? formatCurrency(melhorMes.saldo) : "—"}</p>
                  <p className="text-sm text-muted-foreground">{melhorMes?.mes ?? "—"}</p>
                </CardContent>
              </Card>
              <Card className="border-red-200 dark:border-red-800">
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-red-500 font-semibold uppercase mb-2">Pior mês</p>
                  <p className="text-xl font-bold text-red-500">{piorMes ? formatCurrency(piorMes.saldo) : "—"}</p>
                  <p className="text-sm text-muted-foreground">{piorMes?.mes ?? "—"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-muted-foreground font-semibold uppercase mb-2">Poupança média mensal</p>
                  <p className="text-xl font-bold">{formatCurrency(totalSaldo / n)}</p>
                  <p className="text-sm text-muted-foreground">{n} {n === 1 ? "mês" : "meses"}</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── FLUXO DE CAIXA ──────────────────────────────────────────── */}
          <TabsContent value="fluxo" className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Total receitas" value={formatCurrency(totalReceitas)} sub={`${formatCurrency(totalReceitas / n)}/mês`} color="text-emerald-500" />
              <KpiCard label="Total despesas" value={formatCurrency(totalDespesas)} sub={`${formatCurrency(totalDespesas / n)}/mês`} />
              <KpiCard label="Saldo líquido" value={formatCurrency(totalSaldo)} color={totalSaldo >= 0 ? "text-emerald-500" : "text-red-500"} />
              <KpiCard label="Taxa poupança" value={`${taxaPoupancaMedia.toFixed(1)}%`}
                color={taxaPoupancaMedia >= 20 ? "text-emerald-500" : taxaPoupancaMedia >= 10 ? "text-amber-500" : "text-red-500"} />
            </div>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Receitas vs Despesas</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={fluxo} barGap={2} barSize={barSize}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={36} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="receitas" name="Receitas" fill="#10b981" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Saldo mensal</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={fluxo} barSize={barSize}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                      <XAxis dataKey="mes" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v >= 0 ? "+" : ""}${(v / 1000).toFixed(0)}k`} width={40} />
                      <Tooltip formatter={(v: any) => formatCurrency(v)} />
                      <ReferenceLine y={0} stroke="hsl(var(--border))" />
                      <Bar dataKey="saldo" name="Saldo" radius={[3, 3, 0, 0]}>
                        {fluxo.map((m, i) => <Cell key={i} fill={m.saldo >= 0 ? "#10b981" : "#ef4444"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Taxa de poupança</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <ComposedChart data={fluxoEnriquecido}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                      <XAxis dataKey="mes" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v.toFixed(0)}%`} width={36} />
                      <Tooltip formatter={(v: any) => `${Number(v).toFixed(1)}%`} />
                      <ReferenceLine y={20} stroke="#f59e0b" strokeDasharray="4 4" />
                      <ReferenceLine y={0} stroke="hsl(var(--border))" />
                      <Bar dataKey="taxaPoupanca" name="Taxa poupança" radius={[3, 3, 0, 0]}>
                        {fluxoEnriquecido.map((m, i) => <Cell key={i} fill={m.taxaPoupanca >= 20 ? "#10b981" : m.taxaPoupanca >= 0 ? "#f59e0b" : "#ef4444"} />)}
                      </Bar>
                      <Line type="monotone" dataKey="taxaPoupanca" stroke="#3b82f6" dot={false} strokeWidth={1.5} strokeDasharray="3 3" legendType="none" />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-muted-foreground mt-1">Linha tracejada = tendência · linha amarela = meta 20%</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Detalhe mensal</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-medium">Mês</th>
                        <th className="text-right px-4 py-2.5 font-medium text-emerald-600">Receitas</th>
                        <th className="text-right px-4 py-2.5 font-medium text-red-500">Despesas</th>
                        <th className="text-right px-4 py-2.5 font-medium">Saldo</th>
                        <th className="text-right px-4 py-2.5 font-medium">Taxa poup.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {fluxoEnriquecido.map((m: any) => (
                        <tr key={m.mes} className="hover:bg-muted/40 transition-colors">
                          <td className="px-4 py-2.5 font-medium">{m.mes}</td>
                          <td className="px-4 py-2.5 text-right text-emerald-600">{formatCurrency(m.receitas)}</td>
                          <td className="px-4 py-2.5 text-right text-red-500">{formatCurrency(m.despesas)}</td>
                          <td className={cn("px-4 py-2.5 text-right font-semibold", m.saldo >= 0 ? "text-emerald-600" : "text-red-500")}>
                            {formatCurrency(m.saldo)}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded",
                              m.taxaPoupanca >= 20 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                              m.taxaPoupanca >= 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                              "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400")}>
                              {m.taxaPoupanca.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/60 font-semibold border-t-2">
                        <td className="px-4 py-2.5">Total / Média</td>
                        <td className="px-4 py-2.5 text-right text-emerald-600">{formatCurrency(totalReceitas)}</td>
                        <td className="px-4 py-2.5 text-right text-red-500">{formatCurrency(totalDespesas)}</td>
                        <td className={cn("px-4 py-2.5 text-right", totalSaldo >= 0 ? "text-emerald-600" : "text-red-500")}>{formatCurrency(totalSaldo)}</td>
                        <td className="px-4 py-2.5 text-right text-xs">{taxaPoupancaMedia.toFixed(1)}%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── CATEGORIAS ──────────────────────────────────────────────── */}
          <TabsContent value="categorias" className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <Card className="xl:col-span-1">
                <CardHeader className="pb-2"><CardTitle className="text-base">Distribuição</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={categorias} dataKey="valor" nameKey="nome" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                        {categorias.map((c: any, i: number) => <Cell key={i} fill={c.cor || CORES[i % CORES.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => formatCurrency(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-2 max-h-[200px] overflow-y-auto">
                    {categorias.map((c: any, i: number) => (
                      <div key={c.nome} className="flex items-center gap-2 text-xs">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: c.cor || CORES[i % CORES.length] }} />
                        <span className="truncate">{c.nome}</span>
                        <span className="ml-auto font-medium shrink-0">{formatCurrency(c.valor)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="xl:col-span-2">
                <CardHeader className="pb-2"><CardTitle className="text-base">Ranking de despesas</CardTitle></CardHeader>
                <CardContent>
                  {categorias.length === 0
                    ? <p className="text-sm text-muted-foreground py-8 text-center">Sem despesas no período</p>
                    : <div className="space-y-3">
                      {categorias.slice(0, 12).map((c: any, i: number) => {
                        const total = categorias.reduce((s: number, x: any) => s + x.valor, 0);
                        const pct = total > 0 ? (c.valor / total) * 100 : 0;
                        return (
                          <div key={c.nome}>
                            <div className="flex items-center justify-between text-sm mb-1">
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground text-xs w-4">#{i + 1}</span>
                                <span className="font-medium truncate max-w-[180px]">{c.nome}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
                                <span className="font-semibold">{formatCurrency(c.valor)}</span>
                              </div>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c.cor || CORES[i % CORES.length] }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  }
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── PATRIMÔNIO ──────────────────────────────────────────────── */}
          <TabsContent value="patrimonio" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <KpiCard label="Total ativos" value={formatCurrency(toNumber(patrimonio?.totalAtivos))} color="text-emerald-500" sub={`${ativosBreakdown.length} classes`} />
              <KpiCard label="Total passivos" value={formatCurrency(toNumber(patrimonio?.totalPassivos))} color="text-red-500" />
              <KpiCard label="Net Worth" value={formatCurrency(toNumber(patrimonio?.netWorth))}
                color={toNumber(patrimonio?.netWorth) >= 0 ? "text-blue-500" : "text-red-500"} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Alocação de ativos</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={ativosBreakdown} dataKey="valor" nameKey="nome" cx="50%" cy="50%" outerRadius={80} innerRadius={45}>
                        {ativosBreakdown.map((a, i) => <Cell key={i} fill={a.cor} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => formatCurrency(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2.5 mt-3">
                    {ativosBreakdown.map((a) => (
                      <div key={a.nome} className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: a.cor }} />
                        <span className="text-sm flex-1">{a.nome}</span>
                        <span className="text-xs text-muted-foreground">{totalAtivos > 0 ? ((a.valor / totalAtivos) * 100).toFixed(0) : 0}%</span>
                        <span className="font-semibold text-sm">{formatCurrency(a.valor)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                {(patrimonio?.contas ?? []).length > 0 && (
                  <Card>
                    <CardHeader className="pb-2 flex flex-row items-center gap-2">
                      <Wallet className="h-4 w-4 text-blue-500" />
                      <CardTitle className="text-base">Contas bancárias</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {patrimonio.contas.map((c: any) => (
                        <div key={c.nome} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.cor }} />
                            <span>{c.nome}</span>
                          </div>
                          <span className="font-semibold">{formatCurrency(c.saldo)}</span>
                        </div>
                      ))}
                      <div className="pt-2 border-t flex justify-between text-sm font-bold">
                        <span>Total</span>
                        <span className="text-blue-500">{formatCurrency(patrimonio.contas.reduce((s: number, c: any) => s + c.saldo, 0))}</span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {(patrimonio?.imoveis ?? []).length > 0 && (
                  <Card>
                    <CardHeader className="pb-2 flex flex-row items-center gap-2">
                      <Home className="h-4 w-4 text-amber-500" />
                      <CardTitle className="text-base">Imóveis</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {patrimonio.imoveis.map((p: any) => (
                        <div key={p.nome} className="text-sm space-y-1">
                          <p className="font-medium">{p.nome}</p>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Valor estimado</span><span>{formatCurrency(p.valorEstimado)}</span>
                          </div>
                          {p.capitalEmDivida > 0 && (
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Capital em dívida</span><span className="text-red-500">-{formatCurrency(p.capitalEmDivida)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-xs font-semibold">
                            <span>Equity</span><span className="text-amber-500">{formatCurrency(p.equity)}</span>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── NET WORTH ───────────────────────────────────────────────── */}
          <TabsContent value="networth" className="space-y-6">
            <p className="text-xs text-muted-foreground -mt-2">Reflecte o estado actual e histórico completo — independente do período seleccionado.</p>

            {/* Hero net worth */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <Card className="lg:col-span-2 border-blue-200 dark:border-blue-800">
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Net Worth actual</p>
                  <p className="text-4xl font-bold text-blue-500 mt-1">{formatCurrency(nwAtual)}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <Delta val={deltaNW} />
                    <span className="text-xs text-muted-foreground">vs mês anterior</span>
                    {ganhoUltimoMes !== 0 && (
                      <span className={cn("text-xs font-medium", ganhoUltimoMes > 0 ? "text-emerald-500" : "text-red-500")}>
                        ({ganhoUltimoMes > 0 ? "+" : ""}{formatCurrency(ganhoUltimoMes)})
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
              <KpiCard label="Poupança mensal média" value={formatCurrency(netWorth?.poupancaMensal ?? 0)} sub="últimos 3 meses" color="text-emerald-500" />
              <KpiCard label="Projeção a 10 anos (base)" value={formatCurrency(projecaoData.find((p: any) => Number(p.ano) >= new Date().getFullYear() + 10)?.base ?? 0)} color="text-purple-500" />
            </div>

            {/* Breakdown actual */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Composição actual</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                  <div className="space-y-3">
                    {breakdownItems.map((b) => {
                      const pctBase = toNumber(netWorth?.atual?.totalAtivos ?? 1);
                      const pct = pctBase > 0 ? Math.abs((b.valor / pctBase) * 100) : 0;
                      return (
                        <div key={b.nome}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <div className="flex items-center gap-2">
                              <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: b.cor }} />
                              <span>{b.nome}</span>
                            </div>
                            <span className={cn("font-semibold", b.valor < 0 ? "text-red-500" : "")}>
                              {b.valor < 0 ? "-" : ""}{formatCurrency(Math.abs(b.valor))}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: b.cor }} />
                          </div>
                        </div>
                      );
                    })}
                    <div className="pt-3 border-t flex justify-between items-center">
                      <span className="text-sm font-bold">Net Worth</span>
                      <span className="font-bold text-blue-500">{formatCurrency(nwAtual)}</span>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={breakdownItems.filter(b => b.valor > 0)} dataKey="valor" nameKey="nome" cx="50%" cy="50%" outerRadius={75} innerRadius={45}>
                        {breakdownItems.filter(b => b.valor > 0).map((b, i) => <Cell key={i} fill={b.cor} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => formatCurrency(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Histórico */}
            {historicoNW.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Evolução histórica</CardTitle>
                  <p className="text-xs text-muted-foreground">Snapshots mensais automáticos</p>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={historicoNW}>
                      <defs>
                        <linearGradient id="gradNW" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradAtivos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                      <XAxis dataKey="data" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={42} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Area type="monotone" dataKey="ativos" name="Ativos" stroke="#10b981" fill="url(#gradAtivos)" strokeWidth={1.5} dot={false} />
                      <Area type="monotone" dataKey="netWorth" name="Net Worth" stroke="#3b82f6" fill="url(#gradNW)" strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="passivos" name="Passivos" stroke="#ef4444" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Milestones */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Marcos financeiros</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  {milestones.map((m) => (
                    <div key={m.label} className={cn("p-3 rounded-lg border text-center transition-colors",
                      m.atingido ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-700" : "border-border")}>
                      <p className={cn("text-base font-bold", m.atingido ? "text-emerald-500" : "text-muted-foreground")}>{m.label}</p>
                      {m.atingido
                        ? <p className="text-xs text-emerald-600 mt-1 font-medium">✓ Atingido</p>
                        : m.ano
                          ? <p className="text-xs text-muted-foreground mt-1">~{m.ano}</p>
                          : <p className="text-xs text-muted-foreground mt-1">—</p>
                      }
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Projeção 3 cenários */}
            {projecaoData.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Projeção a 20 anos — 3 cenários</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Poupança mensal: {formatCurrency(netWorth?.poupancaMensal ?? 0)} · Taxa base: {toNumber(netWorth?.projecoes?.[1]?.points ? 7 : 7)}% ao ano (±2% por cenário)
                  </p>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={projecaoData}>
                      <defs>
                        <linearGradient id="gradOtimista" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradBase" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradConservador" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                      <XAxis dataKey="ano" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={52} />
                      <Tooltip formatter={(v: any) => formatCurrency(v)} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Area type="monotone" dataKey="otimista" name="Otimista (+2%)" stroke="#10b981" fill="url(#gradOtimista)" strokeWidth={1.5} dot={false} />
                      <Area type="monotone" dataKey="base" name="Base" stroke="#8b5cf6" fill="url(#gradBase)" strokeWidth={2.5} dot={false} />
                      <Area type="monotone" dataKey="conservador" name="Conservador (-2%)" stroke="#f59e0b" fill="url(#gradConservador)" strokeWidth={1.5} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>

                  {/* Tabela resumo anos chave */}
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm text-center">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-xs">Ano</th>
                          <th className="px-3 py-2 font-medium text-xs text-amber-600">Conservador</th>
                          <th className="px-3 py-2 font-medium text-xs text-purple-600">Base</th>
                          <th className="px-3 py-2 font-medium text-xs text-emerald-600">Otimista</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {projecaoData.filter((_: any, i: number) => [4, 9, 14, 19].includes(i)).map((p: any) => (
                          <tr key={p.ano} className="hover:bg-muted/40">
                            <td className="px-3 py-2 text-left font-medium">{p.ano}</td>
                            <td className="px-3 py-2 text-amber-600">{formatCurrency(p.conservador)}</td>
                            <td className="px-3 py-2 text-purple-600 font-semibold">{formatCurrency(p.base)}</td>
                            <td className="px-3 py-2 text-emerald-600">{formatCurrency(p.otimista)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 text-center">Estimativa. Não constitui aconselhamento financeiro.</p>
                </CardContent>
              </Card>
            )}

            {historicoNW.length === 0 && projecaoData.length === 0 && (
              <Card><CardContent className="py-12 text-center text-muted-foreground">
                <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>Sem histórico ainda. Os snapshots são criados automaticamente no 1.º acesso de cada mês.</p>
              </CardContent></Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
