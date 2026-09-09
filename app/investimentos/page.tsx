"use client";
import { useEffect, useState, useCallback } from "react";
import { formatCurrency, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TrendingUp, TrendingDown, RefreshCw, AlertCircle, Wallet, BarChart3,
  ArrowUpRight, ArrowDownRight, Upload, List, Calendar, DollarSign,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

// ── Colour palette ────────────────────────────────────────────────────────────
const PALETTE = [
  "#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6",
  "#06b6d4","#ec4899","#84cc16","#f97316","#14b8a6",
];
function tickerColor(ticker: string, idx: number) { return PALETTE[idx % PALETTE.length]; }

// ── Helpers ───────────────────────────────────────────────────────────────────
const MESES_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
function pct(n: number, d: number) { return d > 0 ? ((n / d) * 100).toFixed(1) + "%" : "—"; }
function sign(n: number) { return n >= 0 ? "+" : ""; }
function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  try { return format(new Date(d), "dd MMM yyyy", { locale: pt }); } catch { return "—"; }
}

// ── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={cn("text-2xl font-bold mt-1 tabular-nums", color)}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ── Portfolio Overview tab ────────────────────────────────────────────────────
function PortfolioTab() {
  const [pos, setPos] = useState<any>(null);
  const [cash, setCash] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setErr(null);
    Promise.all([
      fetch("/api/portfolio/positions").then((r) => r.json()),
      fetch("/api/portfolio/cash").then((r) => r.json()),
    ]).then(([p, c]) => {
      if (p.error) throw new Error(p.error);
      setPos(p.data);
      setCash(c.data);
    }).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState />;
  if (err) return <ErrorState msg={err} onRetry={load} />;
  if (!pos) return null;

  const { positions, summary } = pos;
  const cashBal = cash?.cashBalance ?? 0;
  const totalPortfolio = summary.totalMarketValue + cashBal;

  // Pie data by asset type
  const byType: Record<string, number> = {};
  for (const p of positions) {
    const t = p.subtype ?? p.assetType;
    byType[t] = (byType[t] ?? 0) + p.marketValueEur;
  }
  const pieData = Object.entries(byType).map(([name, value], i) => ({ name, value, fill: PALETTE[i % PALETTE.length] }));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="Carteira total" value={formatCurrency(totalPortfolio)} />
        <KpiCard label="Posições" value={formatCurrency(summary.totalMarketValue)}
          sub={`${positions.length} ativos`} />
        <KpiCard label="Cash XTB" value={formatCurrency(cashBal)} color="text-blue-500" />
        <KpiCard
          label="P/L não realizado"
          value={`${sign(summary.totalUnrealizedPnl)}${formatCurrency(summary.totalUnrealizedPnl)}`}
          sub={`${sign(summary.totalUnrealizedPnlPct)}${summary.totalUnrealizedPnlPct.toFixed(2)}%`}
          color={summary.totalUnrealizedPnl >= 0 ? "text-emerald-500" : "text-red-500"}
        />
        <KpiCard label="Custo total" value={formatCurrency(summary.totalOpenCost)} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Positions table */}
        <div className="xl:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <List className="h-4 w-4" />Posições abertas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium">Ativo</th>
                      <th className="text-right px-4 py-2.5 font-medium">Qtd</th>
                      <th className="text-right px-4 py-2.5 font-medium">Custo €</th>
                      <th className="text-right px-4 py-2.5 font-medium">Valor €</th>
                      <th className="text-right px-4 py-2.5 font-medium">P/L</th>
                      <th className="text-right px-4 py-2.5 font-medium">Peso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {positions.map((p: any) => (
                      <tr key={p.instrumentId} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5">
                          <p className="font-semibold">{p.ticker}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[180px]">{p.name}</p>
                          <Badge variant="outline" className="text-[10px] mt-0.5 py-0">{p.subtype ?? p.assetType}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {p.quantity.toFixed(4)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {formatCurrency(p.openCostEur)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                          {formatCurrency(p.marketValueEur)}
                        </td>
                        <td className={cn("px-4 py-2.5 text-right tabular-nums", p.unrealizedPnl >= 0 ? "text-emerald-500" : "text-red-500")}>
                          <span className="font-semibold">{sign(p.unrealizedPnl)}{formatCurrency(p.unrealizedPnl)}</span>
                          <span className="block text-xs">{sign(p.unrealizedPnlPct)}{p.unrealizedPnlPct.toFixed(1)}%</span>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                          {p.portfolioWeight.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t bg-muted/50">
                    <tr>
                      <td className="px-4 py-2.5 font-semibold" colSpan={2}>Total posições</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatCurrency(summary.totalOpenCost)}</td>
                      <td className="px-4 py-2.5 text-right font-bold tabular-nums">{formatCurrency(summary.totalMarketValue)}</td>
                      <td className={cn("px-4 py-2.5 text-right font-bold tabular-nums", summary.totalUnrealizedPnl >= 0 ? "text-emerald-500" : "text-red-500")}>
                        {sign(summary.totalUnrealizedPnl)}{formatCurrency(summary.totalUnrealizedPnl)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Allocation pie */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Alocação</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={72} innerRadius={36}>
                  {pieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Tooltip formatter={(v: any) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 mt-2">
              {pieData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                  <span className="flex-1 truncate">{d.name}</span>
                  <span className="text-muted-foreground">{pct(d.value, summary.totalMarketValue)}</span>
                  <span className="font-semibold w-20 text-right">{formatCurrency(d.value)}</span>
                </div>
              ))}
            </div>

            {/* Cash breakdown */}
            {cash && (
              <div className="mt-4 pt-4 border-t space-y-1">
                <p className="text-xs font-medium text-muted-foreground mb-2">Cash — detalhe</p>
                {[
                  ["Depósitos", cash.breakdown?.deposits],
                  ["Levantamentos", cash.breakdown?.withdrawals],
                  ["Compras", cash.breakdown?.purchases],
                  ["Vendas", cash.breakdown?.sales],
                  ["Dividendos", cash.breakdown?.dividends],
                  ["Juros", cash.breakdown?.interest],
                  ["Impostos retidos", cash.breakdown?.withholdingTax],
                  ["Imp. juros", cash.breakdown?.interestTax],
                ].filter(([, v]) => v && Math.abs(Number(v)) > 0.01).map(([label, v]) => (
                  <div key={String(label)} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={cn("font-medium tabular-nums", Number(v) < 0 ? "text-red-500" : "text-emerald-500")}>
                      {Number(v) >= 0 ? "+" : ""}{formatCurrency(Number(v))}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between text-xs font-bold border-t pt-1">
                  <span>Saldo cash</span>
                  <span className="text-blue-500">{formatCurrency(cashBal)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Income tab ────────────────────────────────────────────────────────────────
function IncomeTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filterTicker, setFilterTicker] = useState("todos");

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/portfolio/income").then((r) => r.json()).then((d) => {
      if (d.error) throw new Error(d.error);
      setData(d.data);
    }).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState />;
  if (err) return <ErrorState msg={err} onRetry={load} />;
  if (!data) return null;

  const { summary, byInstrument, monthly, calendar, events } = data;
  const tickers = byInstrument.map((i: any) => i.ticker);
  const colorMap: Record<string, string> = {};
  tickers.forEach((t: string, i: number) => { colorMap[t] = PALETTE[i % PALETTE.length]; });

  const filteredEvents = filterTicker === "todos" ? events : events.filter((e: any) => e.ticker === filterTicker);

  const currentYear = new Date().getFullYear();
  const thisYearNet = events
    .filter((e: any) => e.date && new Date(e.date).getFullYear() === currentYear)
    .reduce((s: number, e: any) => s + e.netEur, 0);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="Total histórico" value={formatCurrency(summary.totalNet)} sub={`${summary.eventCount} pagamentos`} color="text-emerald-500" />
        <KpiCard label={`Este ano (${currentYear})`} value={formatCurrency(thisYearNet)} />
        <KpiCard label="TTM (12m)" value={formatCurrency(summary.ttmNet)} />
        <KpiCard label="Média mensal" value={formatCurrency(summary.monthlyAvgNet)} sub="TTM" />
        <KpiCard label="Projeção anual" value={formatCurrency(summary.monthlyAvgNet * 12)} color="text-blue-500" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Monthly bar chart */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">Rendimento mensal (últimos 24m)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthly} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                <XAxis dataKey="month" tickFormatter={(v) => {
                  const [y, m] = v.split("-");
                  return `${MESES_PT[parseInt(m) - 1]}-${y.slice(2)}`;
                }} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}€`} width={38} />
                <Tooltip
                  formatter={(v: any, name: string) => [formatCurrency(v), name]}
                  labelFormatter={(l) => {
                    const [y, m] = l.split("-");
                    return `${MESES_PT[parseInt(m) - 1]} ${y}`;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {tickers.map((t: string) => (
                  <Bar key={t} dataKey={t} stackId="a" fill={colorMap[t]} name={t}
                    radius={tickers.indexOf(t) === tickers.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* By instrument */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Por ativo</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {byInstrument.map((i: any) => (
              <div key={i.ticker} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: colorMap[i.ticker] }} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <span className="font-semibold text-sm">{i.ticker}</span>
                    <span className="font-bold text-emerald-500 text-sm">{formatCurrency(i.totalNet)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{i.count} pagamentos · TTM: {formatCurrency(i.ttmNet)}</span>
                    <span>{pct(i.totalNet, summary.totalNet)}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ backgroundColor: colorMap[i.ticker], width: pct(i.totalNet, summary.totalNet) }} />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Payment calendar */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" />Calendário de pagamentos histórico</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Ticker</th>
                  {MESES_PT.map((m) => <th key={m} className="text-center px-1 py-2.5 font-medium text-muted-foreground">{m}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y">
                {byInstrument.map((i: any) => (
                  <tr key={i.ticker} className="hover:bg-muted/30">
                    <td className="px-4 py-2 font-semibold flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorMap[i.ticker] }} />
                      {i.ticker}
                    </td>
                    {Array.from({ length: 12 }, (_, m) => (
                      <td key={m} className="text-center px-1 py-2">
                        {calendar[i.ticker]?.includes(m)
                          ? <span className="inline-block h-4 w-4 rounded-sm" style={{ backgroundColor: colorMap[i.ticker], opacity: 0.8 }} />
                          : <span className="inline-block h-4 w-4 rounded-sm bg-muted/40" />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Events table */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Histórico de pagamentos</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{filteredEvents.length} registos</span>
            <Select value={filterTicker} onValueChange={setFilterTicker}>
              <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {tickers.map((t: string) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background border-b">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Data</th>
                  <th className="text-left px-4 py-2.5 font-medium">Ticker</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Nome</th>
                  <th className="text-left px-4 py-2.5 font-medium">Tipo</th>
                  <th className="text-right px-4 py-2.5 font-medium">Bruto €</th>
                  <th className="text-right px-4 py-2.5 font-medium">Líquido €</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredEvents.map((e: any) => (
                  <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(e.date)}</td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorMap[e.ticker] ?? "#10b981" }} />
                        <span className="font-medium">{e.ticker}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground truncate max-w-[160px]">{e.name}</td>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className="text-[10px]">{e.eventType}</Badge>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(e.grossEur)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-emerald-500 tabular-nums">{formatCurrency(e.netEur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Transactions tab ──────────────────────────────────────────────────────────
function TransactionsTab() {
  const [txs, setTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filterType, setFilterType] = useState("todos");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/portfolio/transactions").then((r) => r.json()).then((d) => {
      if (d.error) throw new Error(d.error);
      setTxs(d.data ?? []);
    }).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState />;
  if (err) return <ErrorState msg={err} onRetry={load} />;

  const types = [...new Set(txs.map((t: any) => t.transactionType))].sort();
  const filtered = filterType === "todos" ? txs : txs.filter((t: any) => t.transactionType === filterType);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const typeColor: Record<string, string> = {
    BUY: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    SELL: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    DIVIDEND: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    DISTRIBUTION: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    WITHHOLDING_TAX: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    DEPOSIT: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
    WITHDRAWAL: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    INTEREST: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
    INTEREST_TAX: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{filtered.length} transações</span>
        <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPage(0); }}>
          <SelectTrigger className="h-8 text-xs w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background border-b">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Data</th>
                  <th className="text-left px-4 py-2.5 font-medium">Tipo</th>
                  <th className="text-left px-4 py-2.5 font-medium">Ticker</th>
                  <th className="text-right px-4 py-2.5 font-medium">Qtd</th>
                  <th className="text-right px-4 py-2.5 font-medium">Preço</th>
                  <th className="text-right px-4 py-2.5 font-medium">Valor €</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">ExternalId</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paged.map((t: any) => (
                  <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(t.transactionDate)}</td>
                    <td className="px-4 py-2">
                      <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium", typeColor[t.transactionType] ?? "bg-muted text-muted-foreground")}>
                        {t.transactionType}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-medium">{t.instrument?.displayTicker ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{t.quantity ? Number(t.quantity).toFixed(4) : "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{t.price ? Number(t.price).toFixed(4) : "—"}</td>
                    <td className={cn("px-4 py-2 text-right tabular-nums font-medium", Number(t.amountEur) >= 0 ? "text-emerald-500" : "text-red-500")}>
                      {t.amountEur != null ? (Number(t.amountEur) >= 0 ? "+" : "") + formatCurrency(Math.abs(Number(t.amountEur))) : "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground font-mono truncate max-w-[160px]">{t.externalId ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
          <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
        </div>
      )}
    </div>
  );
}

// ── XTB Import tab ────────────────────────────────────────────────────────────
function ImportTab({ onDone }: { onDone: () => void }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      setError("Apenas ficheiros .xlsx / .xls são suportados."); return;
    }
    setLoading(true); setError(null); setResult(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await fetch("/api/xtb/v2/importar", { method: "POST", body: fd });
      const d = await r.json();
      if (d.error) { setError(d.error); return; }
      setResult(d.data);
      onDone();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" />Importar histórico XTB (V2)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Importa o relatório completo do xStation5 para o motor de transações V2.</p>
            <p>Processa: Posições abertas · Posições fechadas · Cash Operations (depósitos, compras, vendas, dividendos, juros).</p>
          </div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            className={cn(
              "border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer",
              dragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30"
            )}
            onClick={() => document.getElementById("xtb-v2-file")?.click()}
          >
            <input id="xtb-v2-file" type="file" accept=".xlsx,.xls" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            {loading ? (
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <RefreshCw className="h-8 w-8 animate-spin" />
                <p>A processar ficheiro...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <TrendingUp className="h-10 w-10 opacity-40" />
                <div>
                  <p className="font-medium text-foreground">Arrasta o ficheiro XTB aqui</p>
                  <p className="text-sm">ou clica para selecionar — .xlsx / .xls</p>
                </div>
              </div>
            )}
          </div>
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />{error}
            </div>
          )}
          {result && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-3">
              <p className="font-semibold text-emerald-700 dark:text-emerald-300">Importação V2 concluída</p>
              <div className="grid grid-cols-4 gap-3 text-sm">
                {[
                  ["Instrumentos", result.instruments, "text-blue-600"],
                  ["Transações", result.transactions, "text-foreground"],
                  ["Lotes", result.lots, "text-amber-600"],
                  ["Rendimentos", result.incomeEvents, "text-emerald-600"],
                ].map(([label, val, color]) => (
                  <div key={String(label)} className="text-center p-2 bg-background rounded-lg border">
                    <p className={cn("text-xl font-bold", color)}>{val}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
              {result.duplicates > 0 && <p className="text-xs text-muted-foreground">{result.duplicates} duplicados ignorados</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Shared states ─────────────────────────────────────────────────────────────
function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
      <RefreshCw className="h-5 w-5 animate-spin" /><span>A carregar...</span>
    </div>
  );
}
function ErrorState({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="py-12 text-center space-y-3">
      <AlertCircle className="h-8 w-8 mx-auto text-red-500" />
      <p className="text-red-500 font-medium">{msg}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>Tentar novamente</Button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function InvestimentosPage() {
  const [tab, setTab] = useState("portfolio");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Portfolio XTB</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Motor de transações V2 · dados derivados do ledger</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="portfolio" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" />Portfolio</TabsTrigger>
          <TabsTrigger value="income" className="gap-1.5"><DollarSign className="h-3.5 w-3.5" />Rendimentos</TabsTrigger>
          <TabsTrigger value="transactions" className="gap-1.5"><List className="h-3.5 w-3.5" />Transações</TabsTrigger>
          <TabsTrigger value="import" className="gap-1.5"><Upload className="h-3.5 w-3.5" />Importar XTB</TabsTrigger>
        </TabsList>

        <TabsContent value="portfolio" className="mt-6"><PortfolioTab /></TabsContent>
        <TabsContent value="income" className="mt-6"><IncomeTab /></TabsContent>
        <TabsContent value="transactions" className="mt-6"><TransactionsTab /></TabsContent>
        <TabsContent value="import" className="mt-6">
          <ImportTab onDone={() => setTab("portfolio")} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
