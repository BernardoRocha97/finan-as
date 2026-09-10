"use client";
import React, { useEffect, useState, useCallback } from "react";
import { formatCurrency, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TrendingUp, RefreshCw, AlertCircle, BarChart3,
  Upload, List, Calendar, DollarSign, Zap, Target, Trash2, Plus, Check,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, Area, AreaChart, ReferenceLine,
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
  const [livePrices, setLivePrices] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) =>
    setExpandedRows((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const [pricesAt, setPricesAt] = useState<string | null>(null);

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

  const fetchLivePrices = async () => {
    setLoadingPrices(true);
    try {
      const r = await fetch("/api/portfolio/prices");
      const d = await r.json();
      if (!d.error) { setLivePrices(d.data.prices); setPricesAt(d.data.fetchedAt); }
    } finally { setLoadingPrices(false); }
  };

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState />;
  if (err) return <ErrorState msg={err} onRetry={load} />;
  if (!pos) return null;

  // Merge live prices into positions
  const positions = pos.positions.map((p: any) => {
    const live = livePrices?.[p.instrumentId];
    if (!live?.priceEur) return p;
    const liveMarketValue = Math.round(p.quantity * live.priceEur * 100) / 100;
    const liveUnrealizedPnl = Math.round((liveMarketValue - p.openCostEur) * 100) / 100;
    const liveUnrealizedPnlPct = p.openCostEur > 0 ? Math.round((liveUnrealizedPnl / p.openCostEur) * 10000) / 100 : 0;
    return { ...p, marketValueEur: liveMarketValue, unrealizedPnl: liveUnrealizedPnl, unrealizedPnlPct: liveUnrealizedPnlPct, livePrice: live.priceEur };
  });

  const liveMarketTotal = positions.reduce((s: number, p: any) => s + p.marketValueEur, 0);
  const liveOpenCost = positions.reduce((s: number, p: any) => s + p.openCostEur, 0);
  const liveUnrealizedPnl = liveMarketTotal - liveOpenCost;
  const liveUnrealizedPnlPct = liveOpenCost > 0 ? (liveUnrealizedPnl / liveOpenCost) * 100 : 0;

  const cashBal = cash?.cashBalance ?? 0;
  const totalPortfolio = liveMarketTotal + cashBal;

  // Pie data by asset type using live values
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
        <KpiCard label="Posições" value={formatCurrency(liveMarketTotal)}
          sub={`${positions.length} ativos`} />
        <KpiCard label="Cash XTB" value={formatCurrency(cashBal)} color="text-blue-500" />
        <KpiCard
          label="P/L não realizado"
          value={`${sign(liveUnrealizedPnl)}${formatCurrency(liveUnrealizedPnl)}`}
          sub={`${sign(liveUnrealizedPnlPct)}${liveUnrealizedPnlPct.toFixed(2)}%`}
          color={liveUnrealizedPnl >= 0 ? "text-emerald-500" : "text-red-500"}
        />
        <KpiCard label="Custo total" value={formatCurrency(liveOpenCost)} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Positions table */}
        <div className="xl:col-span-2">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <List className="h-4 w-4" />Posições abertas
              </CardTitle>
              <div className="flex items-center gap-2">
                {pricesAt && (
                  <span className="text-xs text-muted-foreground">
                    {livePrices ? "Live · " : ""}{fmtDate(pricesAt)}
                  </span>
                )}
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={fetchLivePrices} disabled={loadingPrices}>
                  <RefreshCw className={cn("h-3.5 w-3.5", loadingPrices && "animate-spin")} />
                  {loadingPrices ? "A atualizar..." : "Preços live"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium w-6"></th>
                      <th className="text-left px-4 py-2.5 font-medium">Ativo</th>
                      <th className="text-right px-4 py-2.5 font-medium">Qtd</th>
                      <th className="text-right px-4 py-2.5 font-medium">Custo €</th>
                      <th className="text-right px-4 py-2.5 font-medium">Valor €</th>
                      <th className="text-right px-4 py-2.5 font-medium">P/L</th>
                      <th className="text-right px-4 py-2.5 font-medium">Peso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {positions.map((p: any) => {
                      const weight = liveMarketTotal > 0 ? (p.marketValueEur / liveMarketTotal) * 100 : 0;
                      const expanded = expandedRows.has(p.instrumentId);
                      const hasLots = p.lots?.length > 1;
                      return (
                      <React.Fragment key={p.instrumentId}>
                      <tr
                        className={cn("transition-colors", hasLots ? "cursor-pointer hover:bg-muted/40" : "hover:bg-muted/30")}
                        onClick={() => hasLots && toggleRow(p.instrumentId)}
                      >
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {hasLots && (
                            <span className="text-xs select-none">{expanded ? "▾" : "▸"}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="font-semibold">{p.ticker}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[160px]">{p.name}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Badge variant="outline" className="text-[10px] py-0">{p.subtype ?? p.assetType}</Badge>
                            {p.livePrice && <span className="text-[10px] text-emerald-500 font-medium">{formatCurrency(p.livePrice)}</span>}
                            {hasLots && <span className="text-[10px] text-muted-foreground">{p.lots.length} lotes</span>}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{p.quantity.toFixed(4)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(p.openCostEur)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatCurrency(p.marketValueEur)}</td>
                        <td className={cn("px-4 py-2.5 text-right tabular-nums", p.unrealizedPnl >= 0 ? "text-emerald-500" : "text-red-500")}>
                          <span className="font-semibold">{sign(p.unrealizedPnl)}{formatCurrency(p.unrealizedPnl)}</span>
                          <span className="block text-xs">{sign(p.unrealizedPnlPct)}{p.unrealizedPnlPct.toFixed(1)}%</span>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{weight.toFixed(1)}%</td>
                      </tr>
                      {expanded && p.lots?.map((lot: any) => {
                        const lotMv = p.livePrice ? lot.remainingQuantity * p.livePrice : lot.costEur;
                        const lotPnl = lotMv - lot.costEur;
                        const lotPnlPct = lot.costEur > 0 ? (lotPnl / lot.costEur) * 100 : 0;
                        return (
                          <tr key={lot.id} className="bg-muted/20 text-xs border-l-2 border-l-primary/20">
                            <td className="px-3 py-1.5" />
                            <td className="px-4 py-1.5 text-muted-foreground">
                              <span className="font-medium text-foreground">{new Date(lot.purchaseDate).toLocaleDateString("pt-PT")}</span>
                              <span className="ml-2">@ {formatCurrency(lot.unitCost)}/un</span>
                            </td>
                            <td className="px-4 py-1.5 text-right tabular-nums text-muted-foreground">{lot.remainingQuantity.toFixed(4)}</td>
                            <td className="px-4 py-1.5 text-right tabular-nums text-muted-foreground">{formatCurrency(lot.costEur)}</td>
                            <td className="px-4 py-1.5 text-right tabular-nums text-muted-foreground">{formatCurrency(lotMv)}</td>
                            <td className={cn("px-4 py-1.5 text-right tabular-nums", lotPnl >= 0 ? "text-emerald-500" : "text-red-500")}>
                              {sign(lotPnl)}{formatCurrency(lotPnl)}
                              <span className="block text-[10px]">{sign(lotPnlPct)}{lotPnlPct.toFixed(1)}%</span>
                            </td>
                            <td className="px-4 py-1.5" />
                          </tr>
                        );
                      })}
                      </React.Fragment>
                    )})}
                  </tbody>
                  <tfoot className="border-t bg-muted/50">
                    <tr>
                      <td className="px-3 py-2.5" />
                      <td className="px-4 py-2.5 font-semibold" colSpan={2}>Total posições</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatCurrency(liveOpenCost)}</td>
                      <td className="px-4 py-2.5 text-right font-bold tabular-nums">{formatCurrency(liveMarketTotal)}</td>
                      <td className={cn("px-4 py-2.5 text-right font-bold tabular-nums", liveUnrealizedPnl >= 0 ? "text-emerald-500" : "text-red-500")}>
                        {sign(liveUnrealizedPnl)}{formatCurrency(liveUnrealizedPnl)}
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
                  <span className="text-muted-foreground">{pct(d.value, liveMarketTotal)}</span>
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

// ── Performance tab ──────────────────────────────────────────────────────────
function PerformanceTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/portfolio/performance").then((r) => r.json()).then((d) => {
      if (d.error) throw new Error(d.error);
      setData(d.data);
    }).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState />;
  if (err) return <ErrorState msg={err} onRetry={load} />;
  if (!data) return null;

  const { portfolio, instruments } = data;

  const xirrColor = (v: number | null) => {
    if (v === null) return "text-muted-foreground";
    if (v >= 10) return "text-emerald-500";
    if (v >= 5) return "text-blue-500";
    if (v >= 0) return "text-amber-500";
    return "text-red-500";
  };

  // Bar chart: total return per instrument
  const barData = instruments
    .filter((i: any) => i.totalBuyEur > 0)
    .map((i: any) => ({ name: i.ticker, retorno: i.totalReturn, pct: i.totalReturnPct }))
    .sort((a: any, b: any) => b.retorno - a.retorno);

  return (
    <div className="space-y-6">
      {/* Portfolio KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">XIRR carteira</p>
            <p className={cn("text-3xl font-bold mt-1 tabular-nums", xirrColor(portfolio.xirr))}>
              {portfolio.xirr !== null ? `${portfolio.xirr >= 0 ? "+" : ""}${portfolio.xirr.toFixed(2)}%` : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">rentabilidade anualizada real</p>
          </CardContent>
        </Card>
        <KpiCard label="Yield on Cost (TTM)" value={`${portfolio.portfolioYieldOnCost.toFixed(2)}%`}
          sub="rendimento / custo aberto" color="text-amber-500" />
        <KpiCard label="Rendimento TTM" value={formatCurrency(portfolio.ttmIncome)}
          sub="últimos 12 meses" color="text-emerald-500" />
        <KpiCard label="Dividendos total" value={formatCurrency(portfolio.totalDividends)} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Capital investido" value={formatCurrency(portfolio.totalDeployed)} />
        <KpiCard label="Recuperado (vendas+div)" value={formatCurrency(portfolio.totalReturned)} />
        <KpiCard label="Valor aberto atual" value={formatCurrency(portfolio.totalOpenValue)} />
        <KpiCard
          label="Retorno total estimado"
          value={formatCurrency(portfolio.totalReturned + portfolio.totalOpenValue - portfolio.totalDeployed)}
          color={(portfolio.totalReturned + portfolio.totalOpenValue - portfolio.totalDeployed) >= 0 ? "text-emerald-500" : "text-red-500"}
        />
      </div>

      {/* Return chart */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Retorno total por ativo</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} layout="vertical" barSize={16}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
              <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `${v > 0 ? "+" : ""}${formatCurrency(v)}`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={64} />
              <Tooltip formatter={(v: any, name: string) => [name === "retorno" ? formatCurrency(v) : `${v}%`, name === "retorno" ? "Retorno €" : "Retorno %"]} />
              <Bar dataKey="retorno" name="retorno" radius={[0, 4, 4, 0]}>
                {barData.map((d: any, i: number) => (
                  <Cell key={i} fill={d.retorno >= 0 ? "#10b981" : "#ef4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Per-instrument table */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Métricas por instrumento</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Ativo</th>
                  <th className="text-right px-4 py-2.5 font-medium">Investido</th>
                  <th className="text-right px-4 py-2.5 font-medium">Vendas</th>
                  <th className="text-right px-4 py-2.5 font-medium">Dividendos</th>
                  <th className="text-right px-4 py-2.5 font-medium">Em aberto</th>
                  <th className="text-right px-4 py-2.5 font-medium">Retorno</th>
                  <th className="text-right px-4 py-2.5 font-medium">XIRR</th>
                  <th className="text-right px-4 py-2.5 font-medium">YoC TTM</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {instruments.map((i: any) => (
                  <tr key={i.instrumentId} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <p className="font-semibold">{i.ticker}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[160px]">{i.name}</p>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(i.totalBuyEur)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{i.totalSellEur > 0 ? formatCurrency(i.totalSellEur) : "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-emerald-500">{i.totalDividendEur > 0 ? formatCurrency(i.totalDividendEur) : "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{i.openCostEur > 0 ? formatCurrency(i.openCostEur) : "—"}</td>
                    <td className={cn("px-4 py-2.5 text-right tabular-nums font-semibold", i.totalReturn >= 0 ? "text-emerald-500" : "text-red-500")}>
                      <span>{i.totalReturn >= 0 ? "+" : ""}{formatCurrency(i.totalReturn)}</span>
                      <span className="block text-xs font-normal">{i.totalReturnPct >= 0 ? "+" : ""}{i.totalReturnPct.toFixed(1)}%</span>
                    </td>
                    <td className={cn("px-4 py-2.5 text-right tabular-nums font-semibold", xirrColor(i.xirr))}>
                      {i.xirr !== null ? `${i.xirr >= 0 ? "+" : ""}${i.xirr.toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-amber-500 font-medium">
                      {i.yieldOnCost > 0 ? `${i.yieldOnCost.toFixed(2)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        XIRR usa o valor de custo dos lotes abertos como valor terminal (sem preços live). Para XIRR preciso, carrega preços live na tab Portfolio.
      </p>
    </div>
  );
}

// ── Allocation tab ────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  OK:          { label: "OK",          cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  OVERWEIGHT:  { label: "Excesso",     cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  UNDERWEIGHT: { label: "Deficit",     cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  NO_TARGET:   { label: "Sem target",  cls: "bg-muted text-muted-foreground" },
  NOT_HELD:    { label: "Não detido",  cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
};

function AllocationTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [instruments, setInstruments] = useState<any[]>([]);
  const [form, setForm] = useState({ instrumentId: "", targetWeight: "", minWeight: "", maxWeight: "", priority: "0", notes: "" });
  const [saving, setSaving] = useState(false);
  const [editRow, setEditRow] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/portfolio/allocation").then((r) => r.json()),
      fetch("/api/portfolio/positions").then((r) => r.json()),
    ]).then(([alloc, pos]) => {
      if (alloc.error) throw new Error(alloc.error);
      setData(alloc.data);
      setInstruments(pos.data?.positions ?? []);
    }).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.instrumentId || !form.targetWeight) return;
    setSaving(true);
    await fetch("/api/portfolio/allocation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instrumentId: form.instrumentId,
        targetWeight: Number(form.targetWeight),
        minWeight: form.minWeight ? Number(form.minWeight) : null,
        maxWeight: form.maxWeight ? Number(form.maxWeight) : null,
        priority: Number(form.priority),
        notes: form.notes || null,
      }),
    });
    setSaving(false);
    setForm({ instrumentId: "", targetWeight: "", minWeight: "", maxWeight: "", priority: "0", notes: "" });
    load();
  };

  const quickEdit = async (instrumentId: string, targetWeight: number) => {
    await fetch("/api/portfolio/allocation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instrumentId, targetWeight }),
    });
    setEditRow(null);
    load();
  };

  const remove = async (targetId: string) => {
    await fetch(`/api/portfolio/allocation/${targetId}`, { method: "DELETE" });
    load();
  };

  if (loading) return <LoadingState />;
  if (err) return <ErrorState msg={err} onRetry={load} />;
  if (!data) return null;

  const { rows, buyQueue, summary } = data;

  // Gap bar: max abs gap for scaling
  const maxGap = Math.max(...rows.map((r: any) => Math.abs(r.gap)), 5);

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="Valor total" value={formatCurrency(summary.totalValue)} />
        <KpiCard label="Targets definidos" value={`${summary.targetsSet}`} sub={`soma: ${summary.targetTotal.toFixed(1)}%`} />
        <KpiCard label="Em deficit" value={`${summary.underweight}`} color={summary.underweight > 0 ? "text-amber-500" : "text-muted-foreground"} />
        <KpiCard label="Em excesso" value={`${summary.overweight}`} color={summary.overweight > 0 ? "text-red-500" : "text-muted-foreground"} />
        <KpiCard label="OK" value={`${summary.ok}`} color="text-emerald-500" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main allocation table */}
        <div className="xl:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" />Peso atual vs target</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium">Ativo</th>
                      <th className="text-right px-4 py-2.5 font-medium">Atual</th>
                      <th className="text-right px-4 py-2.5 font-medium">Target</th>
                      <th className="text-right px-4 py-2.5 font-medium">Gap</th>
                      <th className="px-4 py-2.5 font-medium">Barra</th>
                      <th className="text-center px-4 py-2.5 font-medium">Estado</th>
                      <th className="px-2 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((r: any) => {
                      const cfg = STATUS_CFG[r.status] ?? STATUS_CFG.NO_TARGET;
                      const isEditing = editRow === r.instrumentId;
                      return (
                        <tr key={r.instrumentId} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2.5">
                            <p className="font-semibold">{r.ticker}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[160px]">{r.name}</p>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-medium">{r.currentWeight.toFixed(1)}%</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                            {isEditing ? (
                              <Input
                                className="w-20 h-6 text-xs text-right p-1"
                                value={editWeight}
                                onChange={(e) => setEditWeight(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") quickEdit(r.instrumentId, Number(editWeight));
                                  if (e.key === "Escape") setEditRow(null);
                                }}
                                autoFocus
                              />
                            ) : (
                              <span
                                className="cursor-pointer hover:text-foreground transition-colors"
                                onClick={() => { setEditRow(r.instrumentId); setEditWeight(String(r.targetWeight)); }}
                              >
                                {r.targetWeight > 0 ? `${r.targetWeight.toFixed(1)}%` : "—"}
                              </span>
                            )}
                          </td>
                          <td className={cn("px-4 py-2.5 text-right tabular-nums font-semibold", r.gap > 0 ? "text-red-500" : r.gap < 0 ? "text-amber-500" : "text-muted-foreground")}>
                            {r.targetWeight > 0 ? `${r.gap > 0 ? "+" : ""}${r.gap.toFixed(1)}%` : "—"}
                          </td>
                          <td className="px-4 py-2.5 w-28">
                            {r.targetWeight > 0 && (
                              <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                                {/* Target marker */}
                                <div className="absolute top-0 bottom-0 w-0.5 bg-foreground/40 z-10"
                                  style={{ left: `${(r.targetWeight / (r.targetWeight + maxGap)) * 50}%` }} />
                                {/* Current bar */}
                                <div className={cn("absolute top-0 bottom-0 rounded-full", r.gap > 0 ? "bg-red-400" : "bg-emerald-400")}
                                  style={{ width: `${Math.min((r.currentWeight / (r.targetWeight + maxGap)) * 50, 100)}%` }} />
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium", cfg.cls)}>{cfg.label}</span>
                          </td>
                          <td className="px-2 py-2.5">
                            <div className="flex items-center gap-1">
                              {isEditing && (
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-emerald-500"
                                  onClick={() => quickEdit(r.instrumentId, Number(editWeight))}>
                                  <Check className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {r.targetId && (
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600"
                                  onClick={() => remove(r.targetId)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Buy queue */}
          {buyQueue.length > 0 && (
            <Card className="border-amber-200 dark:border-amber-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-amber-600 dark:text-amber-400">Fila de compras — mais subponderado primeiro</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-amber-50 dark:bg-amber-900/20">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-amber-700 dark:text-amber-300">#</th>
                      <th className="text-left px-4 py-2 font-medium text-amber-700 dark:text-amber-300">Ativo</th>
                      <th className="text-right px-4 py-2 font-medium text-amber-700 dark:text-amber-300">Atual</th>
                      <th className="text-right px-4 py-2 font-medium text-amber-700 dark:text-amber-300">Target</th>
                      <th className="text-right px-4 py-2 font-medium text-amber-700 dark:text-amber-300">Deficit</th>
                      <th className="text-right px-4 py-2 font-medium text-amber-700 dark:text-amber-300">Montante</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {buyQueue.map((r: any, idx: number) => {
                      const deficitPct = Math.abs(r.gap);
                      const buyAmount = (deficitPct / 100) * summary.totalValue;
                      return (
                        <tr key={r.instrumentId} className="hover:bg-amber-50/50 dark:hover:bg-amber-900/10">
                          <td className="px-4 py-2.5 text-muted-foreground font-bold">#{idx + 1}</td>
                          <td className="px-4 py-2.5">
                            <p className="font-semibold">{r.ticker}</p>
                            <p className="text-xs text-muted-foreground">{r.name}</p>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{r.currentWeight.toFixed(1)}%</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{r.targetWeight.toFixed(1)}%</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-amber-600 font-semibold">-{deficitPct.toFixed(1)}%</td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-bold text-amber-600">{formatCurrency(buyAmount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Add target form */}
        <Card className="h-fit">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" />Definir target</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Instrumento</Label>
              <Select value={form.instrumentId} onValueChange={(v) => setForm({ ...form, instrumentId: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleciona..." /></SelectTrigger>
                <SelectContent>
                  {instruments.map((i: any) => (
                    <SelectItem key={i.instrumentId} value={i.instrumentId}>{i.ticker} — {i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Target %</Label>
                <Input className="h-8 text-xs" type="number" step="0.5" placeholder="Ex: 15.0"
                  value={form.targetWeight} onChange={(e) => setForm({ ...form, targetWeight: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Prioridade</Label>
                <Input className="h-8 text-xs" type="number" step="1" placeholder="0"
                  value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Mín %</Label>
                <Input className="h-8 text-xs" type="number" step="0.5" placeholder="opcional"
                  value={form.minWeight} onChange={(e) => setForm({ ...form, minWeight: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Máx %</Label>
                <Input className="h-8 text-xs" type="number" step="0.5" placeholder="opcional"
                  value={form.maxWeight} onChange={(e) => setForm({ ...form, maxWeight: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notas</Label>
              <Input className="h-8 text-xs" placeholder="opcional"
                value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <Button className="w-full h-8 text-xs" onClick={save} disabled={saving || !form.instrumentId || !form.targetWeight}>
              {saving ? "A guardar..." : "Guardar target"}
            </Button>
            <p className="text-xs text-muted-foreground">Clica no valor Target na tabela para editar inline.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Projections tab ───────────────────────────────────────────────────────────
const SCENARIOS = [
  { key: "conservative", label: "Conservador", return: 0.05, color: "#f59e0b" },
  { key: "base",         label: "Base",        return: 0.08, color: "#3b82f6" },
  { key: "optimistic",   label: "Optimista",   return: 0.11, color: "#10b981" },
];

function buildProjection(
  start: number, monthlyContrib: number, annualReturn: number,
  dividendYield: number, reinvest: boolean, years: number, inflationRate: number
): { year: number; portfolio: number; income: number; contributions: number; real: number }[] {
  const rows = [];
  let portfolio = start;
  let totalContribs = 0;
  for (let y = 1; y <= years; y++) {
    const dividends = portfolio * dividendYield;
    const growth = portfolio * annualReturn;
    const contrib = monthlyContrib * 12;
    totalContribs += contrib;
    if (reinvest) {
      portfolio = portfolio + growth + contrib;
    } else {
      portfolio = portfolio + (growth - dividends) + contrib;
    }
    const income = portfolio * dividendYield;
    const real = portfolio / Math.pow(1 + inflationRate, y);
    rows.push({ year: new Date().getFullYear() + y, portfolio: Math.round(portfolio), income: Math.round(income), contributions: Math.round(totalContribs), real: Math.round(real) });
  }
  return rows;
}

function ProjecoesTab() {
  const [portfolioValue, setPortfolioValue] = useState(0);
  const [loadingPortfolio, setLoadingPortfolio] = useState(true);

  // Inputs
  const [monthlyContrib, setMonthlyContrib] = useState(200);
  const [dividendYield, setDividendYield] = useState(5);
  const [years, setYears] = useState(20);
  const [inflationRate, setInflationRate] = useState(2.5);
  const [reinvest, setReinvest] = useState(false);

  // FIRE inputs
  const [targetMonthlyIncome, setTargetMonthlyIncome] = useState(2000);
  const [withdrawalRate, setWithdrawalRate] = useState(4);

  useEffect(() => {
    // Use performance API which computes live market value internally
    fetch("/api/portfolio/performance").then((r) => r.json()).then((d) => {
      const live = d.data?.portfolio?.livePortfolioValue ?? 0;
      setPortfolioValue(live);
      setLoadingPortfolio(false);
    }).catch(() => setLoadingPortfolio(false));
  }, []);

  // Build all 3 scenarios
  const allScenarios = SCENARIOS.map((sc) =>
    buildProjection(portfolioValue, monthlyContrib, sc.return, dividendYield / 100, reinvest, years, inflationRate / 100)
  );

  // Chart data: merge by year
  const chartData = allScenarios[0].map((_, i) => {
    const row: any = { year: allScenarios[0][i].year };
    SCENARIOS.forEach((sc, si) => {
      row[sc.key] = allScenarios[si][i].portfolio;
      row[`${sc.key}_income`] = allScenarios[si][i].income;
    });
    return row;
  });

  // FIRE calculation
  const fireTarget = (targetMonthlyIncome * 12) / (withdrawalRate / 100);
  const fireYearByScenario = SCENARIOS.map((sc, si) => {
    const row = allScenarios[si].find((r) => r.portfolio >= fireTarget);
    return row ? row.year - new Date().getFullYear() : null;
  });

  // Income projection at end of horizon
  const endIncome = SCENARIOS.map((sc, si) => allScenarios[si][years - 1]?.income ?? 0);

  const fmt = (v: number) => v >= 1000000
    ? `${(v / 1000000).toFixed(2)}M€`
    : v >= 1000 ? `${(v / 1000).toFixed(1)}k€` : formatCurrency(v);

  if (loadingPortfolio) return <LoadingState />;

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Parâmetros de projeção</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Carteira atual (€)</Label>
              <Input className="h-8 text-xs" type="number" value={portfolioValue}
                onChange={(e) => setPortfolioValue(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Contribuição mensal (€)</Label>
              <Input className="h-8 text-xs" type="number" value={monthlyContrib}
                onChange={(e) => setMonthlyContrib(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Yield dividendos (%)</Label>
              <Input className="h-8 text-xs" type="number" step="0.1" value={dividendYield}
                onChange={(e) => setDividendYield(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Horizonte (anos)</Label>
              <Input className="h-8 text-xs" type="number" min="1" max="40" value={years}
                onChange={(e) => setYears(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Inflação (%)</Label>
              <Input className="h-8 text-xs" type="number" step="0.1" value={inflationRate}
                onChange={(e) => setInflationRate(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Reinvestir dividendos</Label>
              <div className="h-8 flex items-center">
                <button
                  onClick={() => setReinvest((v) => !v)}
                  className={cn("w-10 h-5 rounded-full transition-colors relative",
                    reinvest ? "bg-emerald-500" : "bg-muted-foreground/30")}
                >
                  <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
                    reinvest ? "left-5" : "left-0.5")} />
                </button>
                <span className="text-xs text-muted-foreground ml-2">{reinvest ? "Sim" : "Não"}</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Retornos por cenário: Conservador {(SCENARIOS[0].return * 100).toFixed(0)}% · Base {(SCENARIOS[1].return * 100).toFixed(0)}% · Optimista {(SCENARIOS[2].return * 100).toFixed(0)}% ao ano (bruto).
          </p>
        </CardContent>
      </Card>

      {/* Portfolio projection chart */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Projeção de carteira — {years} anos</CardTitle>
          <div className="flex gap-3">
            {SCENARIOS.map((sc, i) => (
              <div key={sc.key} className="flex items-center gap-1.5 text-xs">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: sc.color }} />
                <span className="text-muted-foreground">{sc.label}: <span className="font-semibold text-foreground">{fmt(allScenarios[i][years - 1]?.portfolio ?? 0)}</span></span>
              </div>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData}>
              <defs>
                {SCENARIOS.map((sc) => (
                  <linearGradient key={sc.key} id={`grad-${sc.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={sc.color} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={sc.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
              <XAxis dataKey="year" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={(v, i) => i % 5 === 0 ? String(v) : ""} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmt} width={56} />
              <Tooltip formatter={(v: any, name: any) => {
                const sc = SCENARIOS.find((s) => s.key === name);
                return [fmt(v), sc?.label ?? name];
              }} />
              {SCENARIOS.map((sc) => (
                <Area key={sc.key} type="monotone" dataKey={sc.key} stroke={sc.color} strokeWidth={2}
                  fill={`url(#grad-${sc.key})`} dot={false} name={sc.key} />
              ))}
              {portfolioValue > 0 && fireTarget > portfolioValue && (
                <ReferenceLine y={fireTarget} stroke="#ef4444" strokeDasharray="4 4"
                  label={{ value: "FIRE", position: "insideTopRight", fontSize: 10, fill: "#ef4444" }} />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Income projection chart */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Rendimento anual projetado</CardTitle>
          <div className="flex gap-3">
            {SCENARIOS.map((sc, i) => (
              <div key={sc.key} className="flex items-center gap-1.5 text-xs">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: sc.color }} />
                <span className="text-muted-foreground">{sc.label}: <span className="font-semibold text-foreground">{formatCurrency(endIncome[i])}/ano</span></span>
              </div>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
              <XAxis dataKey="year" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={(v, i) => i % 5 === 0 ? String(v) : ""} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmt} width={56} />
              <Tooltip formatter={(v: any, name: any) => {
                const sc = SCENARIOS.find((s) => `${s.key}_income` === name);
                return [formatCurrency(v), sc?.label ?? name];
              }} />
              {SCENARIOS.map((sc) => (
                <Line key={sc.key} type="monotone" dataKey={`${sc.key}_income`} stroke={sc.color}
                  strokeWidth={2} dot={false} name={`${sc.key}_income`} />
              ))}
              {targetMonthlyIncome > 0 && (
                <ReferenceLine y={targetMonthlyIncome * 12} stroke="#ef4444" strokeDasharray="4 4"
                  label={{ value: `Meta: ${formatCurrency(targetMonthlyIncome)}/mês`, position: "insideTopRight", fontSize: 10, fill: "#ef4444" }} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* FIRE calculator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Calculadora FIRE</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Rendimento mensal alvo (€)</Label>
                <Input className="h-8 text-xs" type="number" value={targetMonthlyIncome}
                  onChange={(e) => setTargetMonthlyIncome(Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Taxa de levantamento (%)</Label>
                <Input className="h-8 text-xs" type="number" step="0.1" value={withdrawalRate}
                  onChange={(e) => setWithdrawalRate(Number(e.target.value))} />
              </div>
            </div>

            <div className="p-4 bg-muted/50 rounded-xl space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Carteira necessária (regra dos {withdrawalRate}%)</span>
                <span className="font-bold text-xl">{fmt(fireTarget)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Carteira atual</span>
                <span className="font-semibold">{fmt(portfolioValue)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Falta</span>
                <span className={cn("font-bold", fireTarget > portfolioValue ? "text-amber-500" : "text-emerald-500")}>
                  {fireTarget <= portfolioValue ? "Já atingido!" : fmt(fireTarget - portfolioValue)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden mt-1">
                <div className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.min((portfolioValue / fireTarget) * 100, 100).toFixed(1)}%` }} />
              </div>
              <p className="text-xs text-muted-foreground text-right">{((portfolioValue / fireTarget) * 100).toFixed(1)}% do objectivo</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Anos até FIRE por cenário:</p>
              {SCENARIOS.map((sc, i) => (
                <div key={sc.key} className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: sc.color }} />
                  <span className="text-sm flex-1">{sc.label}</span>
                  <span className="font-bold tabular-nums">
                    {fireYearByScenario[i] !== null
                      ? `${fireYearByScenario[i]} anos (${new Date().getFullYear() + fireYearByScenario[i]!})`
                      : `> ${years} anos`}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Summary table */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Resumo em {years} anos</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Cenário</th>
                  <th className="text-right px-4 py-2.5 font-medium">Carteira</th>
                  <th className="text-right px-4 py-2.5 font-medium">Rend. Anual</th>
                  <th className="text-right px-4 py-2.5 font-medium">Rend. Mensal</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {SCENARIOS.map((sc, i) => {
                  const last = allScenarios[i][years - 1];
                  return (
                    <tr key={sc.key} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: sc.color }} />
                          <span className="font-medium">{sc.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground ml-4">{(sc.return * 100).toFixed(0)}%/ano</p>
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">{fmt(last?.portfolio ?? 0)}</td>
                      <td className="px-4 py-3 text-right text-emerald-500 font-semibold tabular-nums">{fmt(last?.income ?? 0)}</td>
                      <td className="px-4 py-3 text-right text-emerald-500 tabular-nums">{formatCurrency((last?.income ?? 0) / 12)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t">
              <p className="text-xs text-muted-foreground">
                Valores nominais. Real (ajust. {inflationRate}% inflação) no cenário base em {years} anos: {fmt(allScenarios[1][years - 1]?.real ?? 0)}.
                Não constitui aconselhamento financeiro.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Milestone table — every 5 years */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Milestones (cenário base)</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Ano</th>
                  <th className="text-right px-4 py-2.5 font-medium">Carteira</th>
                  <th className="text-right px-4 py-2.5 font-medium">Contribuições</th>
                  <th className="text-right px-4 py-2.5 font-medium">Rend. Anual</th>
                  <th className="text-right px-4 py-2.5 font-medium">Rend. Mensal</th>
                  <th className="text-right px-4 py-2.5 font-medium">Real (inflação)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {allScenarios[1]
                  .filter((_, i) => (i + 1) % 5 === 0 || i === 0)
                  .map((r) => (
                    <tr key={r.year} className={cn("hover:bg-muted/30", r.portfolio >= fireTarget && "bg-emerald-50/50 dark:bg-emerald-900/10")}>
                      <td className="px-4 py-2.5 font-medium">
                        {r.year}
                        {r.portfolio >= fireTarget && <span className="ml-2 text-[10px] text-emerald-500 font-bold">FIRE</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold tabular-nums">{fmt(r.portfolio)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{fmt(r.contributions)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-emerald-500">{fmt(r.income)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-emerald-500">{formatCurrency(r.income / 12)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{fmt(r.real)}</td>
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
          <TabsTrigger value="performance" className="gap-1.5"><Zap className="h-3.5 w-3.5" />Performance</TabsTrigger>
          <TabsTrigger value="allocation" className="gap-1.5"><Target className="h-3.5 w-3.5" />Alocação</TabsTrigger>
          <TabsTrigger value="transactions" className="gap-1.5"><List className="h-3.5 w-3.5" />Transações</TabsTrigger>
          <TabsTrigger value="import" className="gap-1.5"><Upload className="h-3.5 w-3.5" />Importar XTB</TabsTrigger>
          <TabsTrigger value="projections" className="gap-1.5"><TrendingUp className="h-3.5 w-3.5" />Projeções</TabsTrigger>
        </TabsList>

        <TabsContent value="portfolio" className="mt-6"><PortfolioTab /></TabsContent>
        <TabsContent value="income" className="mt-6"><IncomeTab /></TabsContent>
        <TabsContent value="performance" className="mt-6"><PerformanceTab /></TabsContent>
        <TabsContent value="allocation" className="mt-6"><AllocationTab /></TabsContent>
        <TabsContent value="transactions" className="mt-6"><TransactionsTab /></TabsContent>
        <TabsContent value="import" className="mt-6">
          <ImportTab onDone={() => setTab("portfolio")} />
        </TabsContent>
        <TabsContent value="projections" className="mt-6"><ProjecoesTab /></TabsContent>
      </Tabs>
    </div>
  );
}
