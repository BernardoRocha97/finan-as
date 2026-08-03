"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { formatCurrency, formatDate, toNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
  LineChart, Line, ReferenceLine, AreaChart, Area,
} from "recharts";
import {
  TrendingUp, TrendingDown, PiggyBank, ChevronLeft, ChevronRight,
  ArrowUpRight, ArrowDownRight, Minus, RefreshCw, Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { format, subMonths, addMonths, parseISO } from "date-fns";
import { pt } from "date-fns/locale";

// ── types ────────────────────────────────────────────────────────────────────

type Periodo = "mes" | "2meses" | "6meses" | "ano" | "ano_atual" | "ano_anterior";

interface MesData {
  mes: string;
  mesLabel: string;
  data: string;
  receitas: number;
  despesas: number;
  saldo: number;
  taxaPoupanca: number;
}

interface CatData {
  nome: string;
  cor: string;
  valor: number;
  count: number;
}

interface TxData {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  categoria: string;
  categoriaCor: string;
  conta: string;
}

interface ApiData {
  porMes: MesData[];
  despesasCat: CatData[];
  receitasCat: CatData[];
  topDespesas: TxData[];
  topReceitas: TxData[];
  todasCategorias: string[];
  totais: { receitas: number; despesas: number; saldo: number; taxaPoupanca: number };
  periodo: { inicio: string; fim: string };
}

// ── helpers ──────────────────────────────────────────────────────────────────

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: "mes", label: "Mês" },
  { value: "2meses", label: "2 Meses" },
  { value: "6meses", label: "6 Meses" },
  { value: "ano", label: "12 Meses" },
  { value: "ano_atual", label: "Este Ano" },
  { value: "ano_anterior", label: "Ano Anterior" },
];

function DeltaChip({ value, inverted = false, suffix = "" }: { value: number; inverted?: boolean; suffix?: string }) {
  const positive = inverted ? value < 0 : value > 0;
  const zero = Math.abs(value) < 0.01;
  if (zero) return <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="h-3 w-3" />—</span>;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", positive ? "text-emerald-500" : "text-red-500")}>
      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {suffix}{formatCurrency(Math.abs(value))}
    </span>
  );
}

function StatBox({ label, value, sub, color = "default" }: { label: string; value: string; sub?: React.ReactNode; color?: "green" | "red" | "blue" | "default" }) {
  const colors = { green: "text-emerald-500", red: "text-red-500", blue: "text-blue-500", default: "" };
  return (
    <div className="text-center p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className={cn("text-2xl font-bold", colors[color])}>{value}</p>
      {sub && <div className="mt-1">{sub}</div>}
    </div>
  );
}

const CashTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const rec = payload.find((p: any) => p.dataKey === "receitas")?.value ?? 0;
  const dep = payload.find((p: any) => p.dataKey === "despesas")?.value ?? 0;
  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 text-sm min-w-[160px]">
      <p className="font-semibold mb-2 capitalize">{label}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4"><span className="text-emerald-500">Receitas</span><span>{formatCurrency(rec)}</span></div>
        <div className="flex justify-between gap-4"><span className="text-red-500">Despesas</span><span>{formatCurrency(dep)}</span></div>
        <div className="border-t pt-1 mt-1 flex justify-between gap-4 font-medium">
          <span>Saldo</span>
          <span className={rec - dep >= 0 ? "text-emerald-500" : "text-red-500"}>{formatCurrency(rec - dep)}</span>
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
      <p>{formatCurrency(d.value)}</p>
      <p className="text-xs text-muted-foreground">{((d.payload.percent ?? 0) * 100).toFixed(1)}%</p>
    </div>
  );
};

// ── main ─────────────────────────────────────────────────────────────────────

export default function GestaoMensalPage() {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [mesRef, setMesRef] = useState(() => format(new Date(), "yyyy-MM"));
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("visao-geral");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("");

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ periodo, mes: mesRef });
    if (categoriaFiltro) params.set("categoria", categoriaFiltro);
    fetch(`/api/gestao-mensal?${params}`)
      .then((r) => r.json())
      .then((r) => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [periodo, mesRef, categoriaFiltro]);

  useEffect(() => { load(); }, [load]);

  const navMes = (dir: number) => {
    const d = parseISO(mesRef + "-01");
    setMesRef(format(dir > 0 ? addMonths(d, 1) : subMonths(d, 1), "yyyy-MM"));
  };

  const showMesNav = periodo === "mes" || periodo === "2meses" || periodo === "6meses" || periodo === "ano";

  const periodoLabel = useMemo(() => {
    if (!data) return "";
    const ini = format(parseISO(data.periodo.inicio), "d MMM yy", { locale: pt });
    const fim = format(parseISO(data.periodo.fim), "d MMM yy", { locale: pt });
    return `${ini} – ${fim}`;
  }, [data]);

  const totalDespesas = data?.totais.despesas ?? 0;
  const totalReceitas = data?.totais.receitas ?? 0;

  // saldo evolution for area chart
  const saldoEvo = useMemo(() => {
    if (!data) return [];
    let acc = 0;
    return [...data.porMes].map((m) => {
      acc += m.saldo;
      return { mes: m.mes, saldo: m.saldo, acumulado: Math.round(acc * 100) / 100 };
    });
  }, [data]);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">

      {/* ── Header + controls ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestão Mensal</h1>
          {periodoLabel && <p className="text-sm text-muted-foreground mt-0.5">{periodoLabel}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Período buttons */}
          <div className="flex rounded-lg border overflow-hidden">
            {PERIODOS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriodo(p.value)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors border-r last:border-r-0",
                  periodo === p.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Navegação de mês */}
          {showMesNav && (
            <div className="flex items-center gap-1 border rounded-lg px-2 py-1">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navMes(-1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs font-medium w-16 text-center">
                {format(parseISO(mesRef + "-01"), "MMM yyyy", { locale: pt })}
              </span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navMes(1)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 border rounded-xl overflow-hidden divide-x divide-y lg:divide-y-0">
        <StatBox
          label="Total Receitas"
          value={formatCurrency(totalReceitas)}
          color="green"
          sub={<span className="text-xs text-muted-foreground">{data?.receitasCat.length ?? 0} fontes</span>}
        />
        <StatBox
          label="Total Despesas"
          value={formatCurrency(totalDespesas)}
          color="red"
          sub={<span className="text-xs text-muted-foreground">{data?.despesasCat.length ?? 0} categorias</span>}
        />
        <StatBox
          label="Saldo Líquido"
          value={formatCurrency(data?.totais.saldo ?? 0)}
          color={(data?.totais.saldo ?? 0) >= 0 ? "green" : "red"}
          sub={
            data?.porMes.length === 1 && data.porMes[0] ? (
              <span className="text-xs text-muted-foreground">mês único</span>
            ) : (
              <span className="text-xs text-muted-foreground">
                {(data?.porMes ?? []).filter((m) => m.saldo >= 0).length}/{data?.porMes.length ?? 0} meses positivos
              </span>
            )
          }
        />
        <StatBox
          label="Taxa de Poupança"
          value={`${data?.totais.taxaPoupanca?.toFixed(1) ?? "0.0"}%`}
          color={
            (data?.totais.taxaPoupanca ?? 0) >= 20 ? "green"
              : (data?.totais.taxaPoupanca ?? 0) >= 10 ? "default"
              : "red"
          }
          sub={
            <div className="w-24 mx-auto mt-1">
              <Progress value={Math.min(data?.totais.taxaPoupanca ?? 0, 100)} className="h-1.5" />
            </div>
          }
        />
      </div>

      {/* ── Tabs ─────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="despesas">Despesas</TabsTrigger>
          <TabsTrigger value="receitas">Receitas</TabsTrigger>
          <TabsTrigger value="evolucao">Evolução</TabsTrigger>
        </TabsList>

        {/* ── Tab: Visão Geral ────────────────────────────────── */}
        <TabsContent value="visao-geral" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

            {/* Bar chart receitas vs despesas */}
            <Card className="xl:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Receitas vs Despesas por mês</CardTitle>
              </CardHeader>
              <CardContent>
                {(data?.porMes.length ?? 0) <= 1 ? (
                  // Single month: horizontal bars
                  <div className="space-y-4 py-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Receitas</span>
                        <span className="font-medium text-emerald-500">{formatCurrency(totalReceitas)}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: "100%" }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Despesas</span>
                        <span className="font-medium text-red-500">{formatCurrency(totalDespesas)}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                        <div
                          className="h-full bg-red-500 rounded-full"
                          style={{ width: totalReceitas > 0 ? `${Math.min(100, (totalDespesas / totalReceitas) * 100)}%` : "0%" }}
                        />
                      </div>
                    </div>
                    <div className="border-t pt-3 flex justify-between text-sm">
                      <span className="text-muted-foreground">Saldo</span>
                      <span className={cn("font-bold text-lg", (data?.totais.saldo ?? 0) >= 0 ? "text-emerald-500" : "text-red-500")}>
                        {formatCurrency(data?.totais.saldo ?? 0)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data?.porMes ?? []} barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<CashTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
                      <Legend />
                      <Bar dataKey="receitas" name="Receitas" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={32} />
                      <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Donut despesas */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Despesas por categoria</CardTitle>
              </CardHeader>
              <CardContent>
                {(data?.despesasCat.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sem despesas</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={data?.despesasCat ?? []} dataKey="valor" nameKey="nome" cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={2}>
                          {(data?.despesasCat ?? []).map((c, i) => <Cell key={i} fill={c.cor} />)}
                        </Pie>
                        <Tooltip content={<CatTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1.5 mt-2">
                      {(data?.despesasCat ?? []).slice(0, 7).map((c) => (
                        <div key={c.nome} className="flex items-center gap-2 text-sm">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: c.cor }} />
                          <span className="flex-1 truncate text-muted-foreground">{c.nome}</span>
                          <span className="font-medium text-xs">{formatCurrency(c.valor)}</span>
                          <span className="text-xs text-muted-foreground w-8 text-right">
                            {totalDespesas > 0 ? ((c.valor / totalDespesas) * 100).toFixed(0) : 0}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tabela por mês */}
          {(data?.porMes.length ?? 0) > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Resumo por mês</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-4 py-2.5 font-medium">Mês</th>
                        <th className="text-right px-4 py-2.5 font-medium">Receitas</th>
                        <th className="text-right px-4 py-2.5 font-medium">Despesas</th>
                        <th className="text-right px-4 py-2.5 font-medium">Saldo</th>
                        <th className="text-right px-4 py-2.5 font-medium">Poupança</th>
                        <th className="px-4 py-2.5 font-medium w-32">Barra</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(data?.porMes ?? []).map((m, i) => {
                        const prev = i > 0 ? data?.porMes[i - 1] : null;
                        const pct = m.receitas > 0 ? Math.min(100, (m.despesas / m.receitas) * 100) : 0;
                        return (
                          <tr key={m.data} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-2.5 font-medium capitalize">{m.mesLabel}</td>
                            <td className="px-4 py-2.5 text-right text-emerald-600 font-medium">{formatCurrency(m.receitas)}</td>
                            <td className="px-4 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-red-500 font-medium">{formatCurrency(m.despesas)}</span>
                                {prev && <DeltaChip value={m.despesas - prev.despesas} inverted />}
                              </div>
                            </td>
                            <td className={cn("px-4 py-2.5 text-right font-bold", m.saldo >= 0 ? "text-emerald-600" : "text-red-500")}>
                              {formatCurrency(m.saldo)}
                            </td>
                            <td className={cn("px-4 py-2.5 text-right font-medium", m.taxaPoupanca >= 20 ? "text-emerald-500" : m.taxaPoupanca >= 10 ? "text-amber-500" : "text-red-500")}>
                              {m.taxaPoupanca.toFixed(1)}%
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={cn("h-full rounded-full", pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500")}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/30 font-semibold">
                        <td className="px-4 py-2.5">Total</td>
                        <td className="px-4 py-2.5 text-right text-emerald-600">{formatCurrency(totalReceitas)}</td>
                        <td className="px-4 py-2.5 text-right text-red-500">{formatCurrency(totalDespesas)}</td>
                        <td className={cn("px-4 py-2.5 text-right", (data?.totais.saldo ?? 0) >= 0 ? "text-emerald-600" : "text-red-500")}>
                          {formatCurrency(data?.totais.saldo ?? 0)}
                        </td>
                        <td className="px-4 py-2.5 text-right">{data?.totais.taxaPoupanca?.toFixed(1)}%</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Tab: Despesas ───────────────────────────────────── */}
        <TabsContent value="despesas" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

            {/* Bar horizontal por categoria */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Por categoria</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {(data?.despesasCat ?? []).map((c) => (
                  <div key={c.nome}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: c.cor }} />
                        <span className="font-medium">{c.nome}</span>
                        <span className="text-xs text-muted-foreground">{c.count} trans.</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-red-500">{formatCurrency(c.valor)}</span>
                        <span className="text-xs text-muted-foreground w-8 text-right">
                          {totalDespesas > 0 ? ((c.valor / totalDespesas) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          backgroundColor: c.cor,
                          width: totalDespesas > 0 ? `${(c.valor / totalDespesas) * 100}%` : "0%",
                        }}
                      />
                    </div>
                  </div>
                ))}
                {(data?.despesasCat.length ?? 0) === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">Sem despesas no período</p>
                )}
              </CardContent>
            </Card>

            {/* Donut */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Distribuição</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data?.despesasCat ?? []}
                      dataKey="valor"
                      nameKey="nome"
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={120}
                      paddingAngle={2}
                      label={({ nome, percent }: any) => percent > 0.05 ? `${nome} ${((percent ?? 0) * 100).toFixed(0)}%` : ""}
                      labelLine={false}
                    >
                      {(data?.despesasCat ?? []).map((c, i) => <Cell key={i} fill={c.cor} />)}
                    </Pie>
                    <Tooltip content={<CatTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Tabela transações despesa */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <CardTitle className="text-base">Transações de despesa</CardTitle>
                <div className="flex items-center gap-2">
                  <select
                    value={categoriaFiltro}
                    onChange={(e) => setCategoriaFiltro(e.target.value)}
                    className="text-xs border rounded px-2 py-1 bg-background text-foreground"
                  >
                    <option value="">Todas as categorias</option>
                    {(data?.todasCategorias ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <Badge variant="outline">{data?.topDespesas.length ?? 0} transações</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-4 py-2.5 font-medium">Data</th>
                      <th className="text-left px-4 py-2.5 font-medium">Descrição</th>
                      <th className="text-left px-4 py-2.5 font-medium">Categoria</th>
                      <th className="text-left px-4 py-2.5 font-medium">Conta</th>
                      <th className="text-right px-4 py-2.5 font-medium">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(data?.topDespesas ?? []).map((t) => (
                      <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{formatDate(t.data)}</td>
                        <td className="px-4 py-2 max-w-[240px] truncate">{t.descricao}</td>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-1.5 text-xs">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: t.categoriaCor }} />
                            {t.categoria}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground text-xs">{t.conta}</td>
                        <td className="px-4 py-2 text-right font-semibold text-red-500">{formatCurrency(t.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Receitas ───────────────────────────────────── */}
        <TabsContent value="receitas" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Por fonte de receita</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {(data?.receitasCat ?? []).map((c) => (
                  <div key={c.nome}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: c.cor }} />
                        <span className="font-medium">{c.nome}</span>
                        <span className="text-xs text-muted-foreground">{c.count} trans.</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-emerald-500">{formatCurrency(c.valor)}</span>
                        <span className="text-xs text-muted-foreground w-8 text-right">
                          {totalReceitas > 0 ? ((c.valor / totalReceitas) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: totalReceitas > 0 ? `${(c.valor / totalReceitas) * 100}%` : "0%" }}
                      />
                    </div>
                  </div>
                ))}
                {(data?.receitasCat.length ?? 0) === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">Sem receitas no período</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Distribuição de receitas</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data?.receitasCat ?? []}
                      dataKey="valor"
                      nameKey="nome"
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={120}
                      paddingAngle={2}
                      label={({ nome, percent }: any) => percent > 0.05 ? `${nome} ${((percent ?? 0) * 100).toFixed(0)}%` : ""}
                      labelLine={false}
                    >
                      {(data?.receitasCat ?? []).map((c, i) => <Cell key={i} fill={c.cor} />)}
                    </Pie>
                    <Tooltip content={<CatTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Tabela receitas */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <CardTitle className="text-base">Transações de receita</CardTitle>
                <div className="flex items-center gap-2">
                  <select
                    value={categoriaFiltro}
                    onChange={(e) => setCategoriaFiltro(e.target.value)}
                    className="text-xs border rounded px-2 py-1 bg-background text-foreground"
                  >
                    <option value="">Todas as categorias</option>
                    {(data?.todasCategorias ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <Badge variant="outline">{data?.topReceitas.length ?? 0} transações</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-4 py-2.5 font-medium">Data</th>
                      <th className="text-left px-4 py-2.5 font-medium">Descrição</th>
                      <th className="text-left px-4 py-2.5 font-medium">Categoria</th>
                      <th className="text-left px-4 py-2.5 font-medium">Conta</th>
                      <th className="text-right px-4 py-2.5 font-medium">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(data?.topReceitas ?? []).map((t) => (
                      <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{formatDate(t.data)}</td>
                        <td className="px-4 py-2 max-w-[240px] truncate">{t.descricao}</td>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-1.5 text-xs">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: t.categoriaCor }} />
                            {t.categoria}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground text-xs">{t.conta}</td>
                        <td className="px-4 py-2 text-right font-semibold text-emerald-500">{formatCurrency(t.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Evolução ───────────────────────────────────── */}
        <TabsContent value="evolucao" className="space-y-6 mt-4">
          {(data?.porMes.length ?? 0) <= 1 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Seleciona um período de 2 ou mais meses para ver a evolução.
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Saldo e acumulado */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Saldo mensal e acumulado</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={saldoEvo}>
                      <defs>
                        <linearGradient id="acumGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: any) => formatCurrency(v)} />
                      <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                      <Legend />
                      <Area type="monotone" dataKey="acumulado" name="Acumulado" stroke="#3b82f6" strokeWidth={2} fill="url(#acumGrad)" dot={false} />
                      <Line type="monotone" dataKey="saldo" name="Saldo mensal" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 5" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Taxa de poupança */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Taxa de poupança por mês</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data?.porMes ?? []}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                      <Tooltip formatter={(v: any) => `${Number(v).toFixed(1)}%`} />
                      <ReferenceLine y={20} stroke="#10b981" strokeDasharray="4 4" label={{ value: "Meta 20%", position: "right", fontSize: 10, fill: "#10b981" }} />
                      <Bar dataKey="taxaPoupanca" name="Taxa poupança" radius={[3, 3, 0, 0]} maxBarSize={36}>
                        {(data?.porMes ?? []).map((m, i) => (
                          <Cell key={i} fill={m.taxaPoupanca >= 20 ? "#10b981" : m.taxaPoupanca >= 10 ? "#f59e0b" : "#ef4444"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Linha receitas vs despesas */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Tendência receitas vs despesas</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={data?.porMes ?? []}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<CashTooltip />} />
                      <Legend />
                      <Line type="monotone" dataKey="receitas" name="Receitas" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="despesas" name="Despesas" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
