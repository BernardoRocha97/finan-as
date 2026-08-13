"use client";
import { useEffect, useState, useCallback } from "react";
import { formatCurrency, formatDate, toNumber, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Plus, Pencil, RefreshCw, AlertCircle, TrendingDown, Wallet, Activity, Download, Trash2 } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, BarChart, Bar } from "recharts";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

const TIPOS = ["ETF", "ACAO", "PPR", "CRIPTO", "OBRIGACAO", "OUTRO"];
const CORES = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function InvForm({ initial, onSave, onClose }: any) {
  const [form, setForm] = useState({
    nome: "",
    ticker: "",
    tipo: "ETF",
    quantidade: 0,
    precoMedioCompra: 0,
    valorAtualUnidade: 0,
    dividendYieldManual: "",
    plataforma: "",
    notas: "",
    ...initial,
    // Coerce Decimal/string values from DB to numbers
    quantidade: Number(initial?.quantidade ?? 0),
    precoMedioCompra: Number(initial?.precoMedioCompra ?? 0),
    valorAtualUnidade: Number(initial?.valorAtualUnidade ?? 0),
    dividendYieldManual: initial?.dividendYieldManual != null ? String(Number(initial.dividendYieldManual)) : "",
  });
  const [loading, setLoading] = useState(false);
  const save = async () => {
    setLoading(true);
    const method = initial?.id ? "PUT" : "POST";
    const url = initial?.id ? `/api/investimentos/${initial.id}` : "/api/investimentos";
    const payload = {
      ...form,
      dividendYieldManual: form.dividendYieldManual !== "" ? parseFloat(form.dividendYieldManual) : null,
    };
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setLoading(false); onSave();
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1"><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
        <div className="space-y-1"><Label>Ticker</Label><Input value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1"><Label>Tipo</Label>
          <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>Plataforma</Label><Input value={form.plataforma ?? ""} onChange={(e) => setForm({ ...form, plataforma: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label>Quantidade</Label>
          <Input
            type="number"
            step="0.0001"
            value={form.quantidade}
            onChange={(e) => setForm({ ...form, quantidade: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-1"><Label>Preço médio (€)</Label><MoneyInput value={form.precoMedioCompra} onChange={(v) => setForm({ ...form, precoMedioCompra: v })} /></div>
        <div className="space-y-1"><Label>Valor atual (€)</Label><MoneyInput value={form.valorAtualUnidade} onChange={(v) => setForm({ ...form, valorAtualUnidade: v })} /></div>
      </div>
      <div className="space-y-1">
        <Label>Dividend Yield manual (%) <span className="text-muted-foreground text-xs font-normal">— deixa vazio para calcular automaticamente</span></Label>
        <Input
          type="number"
          step="0.01"
          placeholder="Ex: 7.50"
          value={form.dividendYieldManual}
          onChange={(e) => setForm({ ...form, dividendYieldManual: e.target.value })}
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} disabled={loading || !form.nome || !form.ticker}>{loading ? "A guardar..." : "Guardar"}</Button>
      </DialogFooter>
    </div>
  );
}

function OpForm({ investmentId, contas, onSave, onClose }: any) {
  const [form, setForm] = useState({ tipo: "COMPRA", data: new Date().toISOString().slice(0, 10), quantidade: 0, preco: 0, comissao: 0, valorDividendo: 0, accountId: contas[0]?.id ?? "", notas: "" });
  const [loading, setLoading] = useState(false);
  const save = async () => {
    setLoading(true);
    await fetch(`/api/investimentos/${investmentId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setLoading(false); onSave();
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1"><Label>Tipo</Label>
          <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v ?? "COMPRA" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="COMPRA">Compra</SelectItem>
              <SelectItem value="VENDA">Venda</SelectItem>
              <SelectItem value="DIVIDENDO">Dividendo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>Data</Label><Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
      </div>
      {form.tipo !== "DIVIDENDO" && (
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1"><Label>Quantidade</Label><Input type="number" value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: Number(e.target.value) })} /></div>
          <div className="space-y-1"><Label>Preço (€)</Label><MoneyInput value={form.preco} onChange={(v) => setForm({ ...form, preco: v })} /></div>
          <div className="space-y-1"><Label>Comissão (€)</Label><MoneyInput value={form.comissao} onChange={(v) => setForm({ ...form, comissao: v })} /></div>
        </div>
      )}
      {form.tipo === "DIVIDENDO" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1"><Label>Valor (€)</Label><MoneyInput value={form.valorDividendo} onChange={(v) => setForm({ ...form, valorDividendo: v })} /></div>
          <div className="space-y-1"><Label>Creditar em</Label>
            <Select value={form.accountId} onValueChange={(v) => setForm({ ...form, accountId: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{contas.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} disabled={loading}>{loading ? "A guardar..." : "Registar"}</Button>
      </DialogFooter>
    </div>
  );
}

// ── Movimentos de Investimento Panel ─────────────────────────────────────────

function MovimentosInvestimentoPanel() {
  const [movimentos, setMovimentos] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pagina, setPagina] = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/transacoes?tipo=INVESTIMENTO&pagina=${pagina}&limite=50`)
      .then((r) => r.json())
      .then((d) => { setMovimentos(d.data ?? []); setTotal(d.total ?? 0); setLoading(false); })
      .catch(() => setLoading(false));
  }, [pagina]);

  useEffect(() => { load(); }, [load]);

  const totalInvestido = movimentos.reduce((s, t) => s + toNumber(t.valor), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{total} movimentos classificados como investimento</p>
        </div>
        <Badge variant="outline" className="text-blue-600">Total: {formatCurrency(totalInvestido)}</Badge>
      </div>
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">Data</th>
              <th className="text-left px-4 py-2.5 font-medium">Descrição</th>
              <th className="text-left px-4 py-2.5 font-medium">Categoria</th>
              <th className="text-left px-4 py-2.5 font-medium">Conta</th>
              <th className="text-right px-4 py-2.5 font-medium">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">A carregar...</td></tr>}
            {!loading && movimentos.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                Sem movimentos de investimento. Classifica uma transação como "Investimento" para aparecer aqui.
              </td></tr>
            )}
            {movimentos.map((t) => (
              <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{formatDate(t.data)}</td>
                <td className="px-4 py-2 max-w-[240px] truncate">{t.descricao}</td>
                <td className="px-4 py-2">
                  {t.category ? (
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: t.category.cor }} />
                      {t.category.nome}
                    </span>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-2 text-muted-foreground text-xs">{t.account?.nome ?? "—"}</td>
                <td className="px-4 py-2 text-right font-semibold text-blue-600">{formatCurrency(toNumber(t.valor))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > 50 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>Anterior</Button>
          <span className="text-sm text-muted-foreground py-2">{pagina} / {Math.ceil(total / 50)}</span>
          <Button variant="outline" size="sm" disabled={pagina >= Math.ceil(total / 50)} onClick={() => setPagina(p => p + 1)}>Próxima</Button>
        </div>
      )}
    </div>
  );
}

// ── Dividendos Panel ─────────────────────────────────────────────────────────

const MESES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function buildNextMonths(n: number): string[] {
  const today = new Date();
  const result: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return result;
}

function mesLabel(key: string): string {
  const [year, month] = key.split("-");
  return `${MESES_ABREV[parseInt(month) - 1]}-${year.slice(2)}`;
}

function DividendosPanel({ investimentos }: { investimentos: any[] }) {
  const [allDivs, setAllDivs] = useState<any[]>([]);
  const [calData, setCalData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filtroTicker, setFiltroTicker] = useState<string>("todos");

  useEffect(() => {
    Promise.all([
      fetch("/api/investimentos/dividendos").then((r) => r.json()),
      fetch("/api/investimentos/calendario").then((r) => r.json()),
    ]).then(([divs, cal]) => {
      setAllDivs(divs.data ?? []);
      setCalData(cal.data ?? null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const tickers = [...new Set(allDivs.map((o) => o.ticker))].sort();
  const tickerColor: Record<string, string> = {};
  tickers.forEach((t, i) => { tickerColor[t] = CORES[i % CORES.length]; });

  const divsFiltrados = filtroTicker === "todos" ? allDivs : allDivs.filter((o) => o.ticker === filtroTicker);

  const anoAtual = new Date().getFullYear();
  const anoAnterior = anoAtual - 1;

  const totalDivs = allDivs.reduce((s, o) => s + toNumber(o.valorDividendo), 0);
  const esteAno = allDivs.filter((o) => new Date(o.data).getFullYear() === anoAtual).reduce((s, o) => s + toNumber(o.valorDividendo), 0);
  const anoAnt = allDivs.filter((o) => new Date(o.data).getFullYear() === anoAnterior).reduce((s, o) => s + toNumber(o.valorDividendo), 0);

  // Últimos 12 meses para média
  const hoje = new Date();
  const ha12Meses = new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1);
  const ult12 = allDivs.filter((o) => new Date(o.data) >= ha12Meses).reduce((s, o) => s + toNumber(o.valorDividendo), 0);
  const mediaMensal = ult12 / 12;

  // Projeção anual baseada nos últimos 12 meses
  const projecaoAnual = mediaMensal * 12;

  // Yield médio estimado
  const valorCarteira = investimentos.reduce((s, i) => s + toNumber(i.quantidade) * toNumber(i.valorAtualUnidade), 0);
  const yieldEstimado = valorCarteira > 0 ? (projecaoAnual / valorCarteira) * 100 : 0;

  // Por símbolo
  const simMap: Record<string, { total: number; count: number; esteAno: number }> = {};
  for (const o of allDivs) {
    if (!simMap[o.ticker]) simMap[o.ticker] = { total: 0, count: 0, esteAno: 0 };
    simMap[o.ticker].total += toNumber(o.valorDividendo);
    simMap[o.ticker].count++;
    if (new Date(o.data).getFullYear() === anoAtual) simMap[o.ticker].esteAno += toNumber(o.valorDividendo);
  }
  const porSimbolo = Object.entries(simMap)
    .map(([ticker, v]) => ({ ticker, cor: tickerColor[ticker] ?? "#10b981", ...v }))
    .sort((a, b) => b.total - a.total);

  // Stacked bar chart – últimos 14 meses por ticker
  const stackedMeses: Record<string, Record<string, number>> = {};
  for (const o of allDivs) {
    const d = new Date(o.data);
    const mesKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!stackedMeses[mesKey]) stackedMeses[mesKey] = {};
    stackedMeses[mesKey][o.ticker] = (stackedMeses[mesKey][o.ticker] ?? 0) + toNumber(o.valorDividendo);
  }
  const stackedData = Object.entries(stackedMeses)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([mes, vals]) => ({
      mes: format(new Date(mes + "-01"), "MMM yy", { locale: pt }),
      total: Object.values(vals).reduce((s, v) => s + v, 0),
      ...vals,
    }));

  // Calendar: quais meses cada ticker paga (usando dados históricos)
  const calendarMap: Record<string, Set<number>> = {};
  for (const o of allDivs) {
    const m = new Date(o.data).getMonth();
    if (!calendarMap[o.ticker]) calendarMap[o.ticker] = new Set();
    calendarMap[o.ticker].add(m);
  }

  // Melhor mês histórico
  const totaisMes: Record<string, number> = {};
  for (const row of stackedData) {
    totaisMes[row.mes] = row.total;
  }
  const melhorMes = Object.entries(totaisMes).sort(([, a], [, b]) => b - a)[0];

  // Crescimento YoY
  const crescimentoYoY = anoAnt > 0 ? ((esteAno - anoAnt) / anoAnt) * 100 : null;

  const nextMonths = buildNextMonths(12);
  const calendar = calData?.calendar ?? {};
  const proximos = (calData?.proximos ?? []).slice(0, 30);
  const yieldData: any[] = calData?.yieldData ?? [];

  // tickers that appear in calendar
  const calTickers = [...new Set([
    ...Object.keys(calendar),
    ...yieldData.map((y: any) => y.ticker),
  ])].sort();

  if (loading) return <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin" />A carregar...</div>;

  return (
    <div className="space-y-6">

      {/* ── Yield Table ── */}
      {yieldData.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Yield por ativo</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">Ticker</th>
                    <th className="text-right px-4 py-2.5 font-medium text-amber-600">Dividend Yield</th>
                    <th className="text-right px-4 py-2.5 font-medium text-blue-600">Yield on Cost</th>
                    <th className="text-right px-4 py-2.5 font-medium text-emerald-600">Rendimento Anual</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {yieldData.sort((a: any, b: any) => b.annualIncome - a.annualIncome).map((y: any) => (
                    <tr key={y.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <p className="font-semibold">{y.ticker}</p>
                        <p className="text-xs text-muted-foreground">{y.nome}</p>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={cn("font-semibold", y.dividendYield >= 8 ? "text-emerald-500" : y.dividendYield >= 4 ? "text-amber-500" : "text-muted-foreground")}>
                          {y.dividendYield > 0 ? `${y.dividendYield.toFixed(2)}%` : "—"}
                        </span>
                        {y.dividendYieldManual > 0 && <span className="block text-xs text-blue-500">manual</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-blue-600">
                        {y.yieldOnCost > 0 ? `${y.yieldOnCost.toFixed(2)}%` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-emerald-500">
                        {y.annualIncome > 0 ? formatCurrency(y.annualIncome) : "—"}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-muted/50 font-semibold">
                    <td className="px-4 py-2.5">Total</td>
                    <td className="px-4 py-2.5 text-right text-amber-600">
                      {(() => {
                        const totalV = yieldData.reduce((s: number, y: any) => s + y.portfolioValue, 0);
                        const totalI = yieldData.reduce((s: number, y: any) => s + y.annualIncome, 0);
                        return totalV > 0 ? `${((totalI / totalV) * 100).toFixed(2)}%` : "—";
                      })()}
                    </td>
                    <td className="px-4 py-2.5 text-right text-blue-600">—</td>
                    <td className="px-4 py-2.5 text-right text-emerald-500">
                      {formatCurrency(yieldData.reduce((s: number, y: any) => s + y.annualIncome, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Payout Calendar (next 12 months) ── */}
      {calTickers.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Calendário de Pagamentos — próximos 12 meses</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium sticky left-0 bg-muted">Ticker</th>
                    {nextMonths.map((m) => (
                      <th key={m} className="text-center px-2 py-2 font-medium whitespace-nowrap">{mesLabel(m)}</th>
                    ))}
                    <th className="text-right px-3 py-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {calTickers.filter((t) => calendar[t]).map((ticker) => {
                    const rowTotal = nextMonths.reduce((s, m) => s + (calendar[ticker]?.[m] ?? 0), 0);
                    if (rowTotal === 0) return null;
                    return (
                      <tr key={ticker} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2 font-semibold sticky left-0 bg-background">{ticker}</td>
                        {nextMonths.map((m) => {
                          const val = calendar[ticker]?.[m];
                          return (
                            <td key={m} className="text-center px-2 py-2">
                              {val ? <span className="font-medium text-emerald-600">{formatCurrency(val)}</span> : <span className="text-muted-foreground/30">—</span>}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-right font-bold text-emerald-500">{formatCurrency(rowTotal)}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-muted/50 font-semibold">
                    <td className="px-3 py-2 sticky left-0 bg-muted">Total</td>
                    {nextMonths.map((m) => {
                      const total = calTickers.reduce((s, t) => s + (calendar[t]?.[m] ?? 0), 0);
                      return (
                        <td key={m} className="text-center px-2 py-2 font-bold">
                          {total > 0 ? <span className="text-emerald-600">{formatCurrency(total)}</span> : <span className="text-muted-foreground/30">—</span>}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right text-emerald-500">
                      {formatCurrency(calTickers.reduce((s, t) => s + nextMonths.reduce((ss, m) => ss + (calendar[t]?.[m] ?? 0), 0), 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground px-4 py-2">* Valores estimados com base no histórico de dividendos</p>
          </CardContent>
        </Card>
      )}

      {/* ── Upcoming Dividends List ── */}
      {proximos.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Próximos dividendos estimados</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background border-b">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">Ticker</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Nome</th>
                    <th className="text-center px-4 py-2.5 font-medium">Estado</th>
                    <th className="text-right px-4 py-2.5 font-medium">Data estimada</th>
                    <th className="text-right px-4 py-2.5 font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {proximos.map((p: any, i: number) => (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-semibold">{p.ticker}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground truncate max-w-[160px]">{p.nome}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          Estimado *
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground whitespace-nowrap">
                        {new Date(p.data).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-emerald-500">{formatCurrency(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground px-4 py-2">* Datas e valores estimados com base no padrão histórico de pagamentos</p>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Total histórico</p>
          <p className="text-2xl font-bold text-emerald-500 mt-1">{formatCurrency(totalDivs)}</p>
          <p className="text-xs text-muted-foreground mt-1">{allDivs.length} pagamentos</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Este ano ({anoAtual})</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(esteAno)}</p>
          {crescimentoYoY !== null && (
            <p className={cn("text-xs mt-1 font-medium", crescimentoYoY >= 0 ? "text-emerald-500" : "text-red-500")}>
              {crescimentoYoY >= 0 ? "+" : ""}{crescimentoYoY.toFixed(1)}% vs {anoAnterior}
            </p>
          )}
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Média mensal</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(mediaMensal)}</p>
          <p className="text-xs text-muted-foreground mt-1">últimos 12 meses</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Projeção anual</p>
          <p className="text-2xl font-bold text-blue-500 mt-1">{formatCurrency(projecaoAnual)}</p>
          <p className="text-xs text-muted-foreground mt-1">baseado nos ult. 12m</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Yield estimado</p>
          <p className="text-2xl font-bold text-amber-500 mt-1">{yieldEstimado.toFixed(2)}%</p>
          <p className="text-xs text-muted-foreground mt-1">sobre carteira atual</p>
        </CardContent></Card>
      </div>

      {/* Stacked bar chart + Pie */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Rendimento por mês</CardTitle>
            {melhorMes && <span className="text-xs text-muted-foreground">Melhor mês: <span className="font-medium text-emerald-500">{melhorMes[0]} ({formatCurrency(melhorMes[1])})</span></span>}
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stackedData} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}€`} width={40} />
                <Tooltip formatter={(v: any, name: string) => [formatCurrency(v), name]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {tickers.map((t) => (
                  <Bar key={t} dataKey={t} stackId="a" fill={tickerColor[t]} radius={tickers.indexOf(t) === tickers.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Distribuição por símbolo</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={porSimbolo.map((s) => ({ name: s.ticker, value: s.total, fill: s.cor }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={30}>
                  {porSimbolo.map((s, i) => <Cell key={i} fill={s.cor} />)}
                </Pie>
                <Tooltip formatter={(v: any) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-2">
              {porSimbolo.map((s) => (
                <div key={s.ticker} className="flex items-center gap-2 text-xs">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.cor }} />
                  <span className="font-medium">{s.ticker}</span>
                  <span className="text-muted-foreground ml-auto">{totalDivs > 0 ? ((s.total / totalDivs) * 100).toFixed(0) : 0}%</span>
                  <span className="font-semibold text-emerald-500 w-16 text-right">{formatCurrency(s.total)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calendário de dividendos + Ranking */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Calendário: quais meses cada ticker costuma pagar */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Calendário de pagamentos</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left py-1.5 pr-2 font-medium">Ticker</th>
                    {MESES_PT.map((m) => <th key={m} className="text-center px-1 py-1.5 font-medium text-muted-foreground">{m}</th>)}
                    <th className="text-right px-2 py-1.5 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {porSimbolo.map((s) => (
                    <tr key={s.ticker} className="hover:bg-muted/30">
                      <td className="py-1.5 pr-2">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.cor }} />
                          <span className="font-medium">{s.ticker}</span>
                        </span>
                      </td>
                      {Array.from({ length: 12 }, (_, m) => (
                        <td key={m} className="text-center px-1 py-1.5">
                          {calendarMap[s.ticker]?.has(m)
                            ? <span className="inline-block h-4 w-4 rounded-sm" style={{ backgroundColor: s.cor, opacity: 0.8 }} title={MESES_PT[m]} />
                            : <span className="inline-block h-4 w-4 rounded-sm bg-muted/30" />}
                        </td>
                      ))}
                      <td className="text-right px-2 py-1.5 font-semibold text-emerald-500">{formatCurrency(s.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Ranking + métricas por símbolo */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Ranking de dividendos</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {porSimbolo.map((s, i) => {
              const inv = investimentos.find((x: any) => x.ticker === s.ticker || x.ticker.replace(/\.(US|UK|DE)$/, "") === s.ticker.replace(/\.(US|UK|DE)$/, ""));
              const valorPos = inv ? toNumber(inv.quantidade) * toNumber(inv.valorAtualUnidade) : 0;
              const yieldPos = valorPos > 0 ? ((s.esteAno || s.total / Math.max(1, new Set(allDivs.filter((o) => o.ticker === s.ticker).map((o) => new Date(o.data).getFullYear())).size)) / valorPos) * 100 : 0;
              return (
                <div key={s.ticker} className="flex items-center gap-3">
                  <span className="text-lg font-bold text-muted-foreground w-6 shrink-0">#{i + 1}</span>
                  <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: s.cor }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{s.ticker}</span>
                      <span className="text-sm font-bold text-emerald-500">{formatCurrency(s.total)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-0.5">
                      <span>{s.count} pagamentos · {formatCurrency(s.total / s.count)}/pag</span>
                      {yieldPos > 0 && <span className="text-amber-500 font-medium">{yieldPos.toFixed(1)}% yield</span>}
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full" style={{ backgroundColor: s.cor, width: totalDivs > 0 ? `${(s.total / totalDivs) * 100}%` : "0%" }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Tabela histórico com filtro */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Histórico completo</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{divsFiltrados.length} registos</span>
            <Select value={filtroTicker} onValueChange={setFiltroTicker}>
              <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {tickers.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background border-b">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Data</th>
                  <th className="text-left px-4 py-2.5 font-medium">Símbolo</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Nome</th>
                  <th className="text-right px-4 py-2.5 font-medium">Valor líquido</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {divsFiltrados.map((o: any) => (
                  <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{formatDate(o.data)}</td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tickerColor[o.ticker] ?? "#10b981" }} />
                        <span className="font-medium">{o.ticker}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{o.nome}</td>
                    <td className="px-4 py-2 text-right font-semibold text-emerald-500">{formatCurrency(toNumber(o.valorDividendo))}</td>
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

// ── XTB Import Panel ─────────────────────────────────────────────────────────

function XtbImportPanel({ onDone }: { onDone: () => void }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      setError("Apenas ficheiros .xlsx / .xls são suportados.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await fetch("/api/xtb/importar", { method: "POST", body: fd });
      const d = await r.json();
      if (d.error) { setError(d.error); return; }
      // Auto-update prices after import so portfolio value is correct
      await fetch("/api/investimentos/atualizar-precos", { method: "POST" }).catch(() => {});
      setResult(d.data);
      onDone();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Importar histórico XTB</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Como exportar o ficheiro do xStation5:</p>
            <ol className="list-decimal list-inside space-y-0.5 ml-2">
              <li>Abre o xStation5 (web ou desktop)</li>
              <li>Vai a <strong>Histórico</strong> → <strong>Histórico de transações</strong></li>
              <li>Define o período que queres exportar</li>
              <li>Clica em <strong>Exportar</strong> → <strong>Excel (.xlsx)</strong></li>
              <li>Arrasta o ficheiro para aqui</li>
            </ol>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            className={cn(
              "border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer",
              dragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30"
            )}
            onClick={() => document.getElementById("xtb-file-input")?.click()}
          >
            <input
              id="xtb-file-input"
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
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
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {result && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-3">
              <p className="font-semibold text-emerald-700 dark:text-emerald-300">✓ Importação concluída</p>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="text-center p-2 bg-background rounded-lg border">
                  <p className="text-xl font-bold text-emerald-600">{result.compras}</p>
                  <p className="text-xs text-muted-foreground">Compras</p>
                </div>
                <div className="text-center p-2 bg-background rounded-lg border">
                  <p className="text-xl font-bold text-red-500">{result.vendas}</p>
                  <p className="text-xs text-muted-foreground">Vendas</p>
                </div>
                <div className="text-center p-2 bg-background rounded-lg border">
                  <p className="text-xl font-bold text-blue-500">{result.dividendos}</p>
                  <p className="text-xs text-muted-foreground">Dividendos</p>
                </div>
              </div>
              {result.duplicados > 0 && (
                <p className="text-xs text-muted-foreground">{result.duplicados} duplicados ignorados</p>
              )}
              <p className="text-xs text-muted-foreground">{result.simbolos} símbolos · {result.total} operações importadas</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base text-muted-foreground">Formato suportado</CardTitle></CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1">
          <p>O importador lê o formato oficial de export do xStation5:</p>
          <p>Folha "CASH OPERATION HISTORY" com colunas: <code className="bg-muted px-1 rounded">ID · Type · Time · Comment · Symbol · Amount</code></p>
          <p>Tipos processados: <strong>Stock purchase</strong>, <strong>Stock sale</strong>, <strong>DIVIDENT</strong> (net de Withholding Tax)</p>
          <p>Tipos ignorados: deposit, withdrawal, Free-funds Interest, Withholding Tax (aplicado ao dividendo)</p>
          <p>A importação é incremental — ficheiros sobrepostos não criam duplicados.</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── XTB Live Panel ───────────────────────────────────────────────────────────

function XtbKpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-center p-4 border rounded-xl">
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className={cn("text-xl font-bold", color)}>{value}</p>
    </div>
  );
}

function XtbPanel() {
  const [portfolio, setPortfolio] = useState<any>(null);
  const [historico, setHistorico] = useState<any>(null);
  const [loadingP, setLoadingP] = useState(false);
  const [loadingH, setLoadingH] = useState(false);
  const [errorP, setErrorP] = useState<string | null>(null);
  const [errorH, setErrorH] = useState<string | null>(null);
  const [dias, setDias] = useState(90);
  const [activeTab, setActiveTab] = useState<"posicoes" | "historico">("posicoes");

  const loadPortfolio = useCallback(() => {
    setLoadingP(true);
    setErrorP(null);
    fetch("/api/xtb/portfolio")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setErrorP(d.error);
        else setPortfolio(d.data);
      })
      .catch((e) => setErrorP(e.message))
      .finally(() => setLoadingP(false));
  }, []);

  const loadHistorico = useCallback(() => {
    setLoadingH(true);
    setErrorH(null);
    fetch(`/api/xtb/historico?dias=${dias}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setErrorH(d.error);
        else setHistorico(d.data);
      })
      .catch((e) => setErrorH(e.message))
      .finally(() => setLoadingH(false));
  }, [dias]);

  useEffect(() => { loadPortfolio(); }, [loadPortfolio]);
  useEffect(() => { if (activeTab === "historico") loadHistorico(); }, [activeTab, loadHistorico]);

  // Lucro por símbolo para bar chart
  const lucroPorSimbolo = (portfolio?.posicoes ?? []).map((p: any) => ({
    name: p.simbolo,
    lucro: p.lucroTotal,
  })).sort((a: any, b: any) => b.lucro - a.lucro);

  // Historico agrupado por símbolo
  const lucroHistPorSimbolo: Record<string, number> = {};
  (historico?.trades ?? []).forEach((t: any) => {
    lucroHistPorSimbolo[t.simbolo] = (lucroHistPorSimbolo[t.simbolo] ?? 0) + t.lucroTotal;
  });
  const histBarData = Object.entries(lucroHistPorSimbolo)
    .map(([name, lucro]) => ({ name, lucro }))
    .sort((a, b) => b.lucro - a.lucro)
    .slice(0, 15);

  const configured = !errorP?.includes("não configurados");

  if (!configured || (errorP?.includes("não configurados"))) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <AlertCircle className="h-10 w-10 mx-auto text-amber-500" />
          <div>
            <p className="font-semibold text-lg">Credenciais XTB não configuradas</p>
            <p className="text-muted-foreground text-sm mt-1">
              Abre o ficheiro <code className="bg-muted px-1 rounded">.env</code> na raiz do projeto e preenche:
            </p>
          </div>
          <pre className="bg-muted rounded-lg p-4 text-left text-sm inline-block mx-auto">
{`XTB_USER_ID=o_teu_id
XTB_PASSWORD=a_tua_password
XTB_ACCOUNT_TYPE=real`}
          </pre>
          <p className="text-xs text-muted-foreground">Reinicia o servidor depois de preencher.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex items-center justify-between">
        <div className="flex rounded-lg border overflow-hidden">
          {(["posicoes", "historico"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={cn(
                "px-4 py-1.5 text-sm font-medium transition-colors border-r last:border-r-0",
                activeTab === t ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              {t === "posicoes" ? "Posições abertas" : "Histórico"}
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={activeTab === "posicoes" ? loadPortfolio : loadHistorico}
          disabled={loadingP || loadingH}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", (loadingP || loadingH) && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {/* ── POSIÇÕES ABERTAS ────────────────────────────────────── */}
      {activeTab === "posicoes" && (
        <>
          {loadingP && (
            <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span>A ligar à XTB...</span>
            </div>
          )}
          {errorP && !loadingP && (
            <Card>
              <CardContent className="py-8 text-center">
                <AlertCircle className="h-8 w-8 mx-auto text-red-500 mb-2" />
                <p className="font-medium text-red-500">{errorP}</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={loadPortfolio}>Tentar novamente</Button>
              </CardContent>
            </Card>
          )}
          {portfolio && !loadingP && (
            <>
              {/* Saldo XTB */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <XtbKpi label="Saldo" value={formatCurrency(portfolio.saldo.balance)} />
                <XtbKpi label="Equity" value={formatCurrency(portfolio.saldo.equity)} color={portfolio.saldo.equity >= portfolio.saldo.balance ? "text-emerald-500" : "text-red-500"} />
                <XtbKpi label="Margem Usada" value={formatCurrency(portfolio.saldo.margem)} />
                <XtbKpi label="Margem Livre" value={formatCurrency(portfolio.saldo.margemLivre)} color="text-blue-500" />
                <XtbKpi label="Nível Margem" value={portfolio.saldo.nivelMargem ? `${portfolio.saldo.nivelMargem.toFixed(0)}%` : "—"} color={portfolio.saldo.nivelMargem > 200 ? "text-emerald-500" : "text-amber-500"} />
              </div>

              {/* Resumo posições */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <XtbKpi label="Posições abertas" value={String(portfolio.resumo.totalPosicoes)} />
                <XtbKpi
                  label="Lucro total"
                  value={formatCurrency(portfolio.resumo.totalLucro)}
                  color={portfolio.resumo.totalLucro >= 0 ? "text-emerald-500" : "text-red-500"}
                />
                <XtbKpi label="Positivas / Negativas" value={`${portfolio.resumo.positivasCount} / ${portfolio.resumo.negativasCount}`} />
                <XtbKpi
                  label="Rentab. total"
                  value={`${portfolio.resumo.totalLucroPercent >= 0 ? "+" : ""}${portfolio.resumo.totalLucroPercent.toFixed(2)}%`}
                  color={portfolio.resumo.totalLucroPercent >= 0 ? "text-emerald-500" : "text-red-500"}
                />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Tabela posições */}
                <div className="xl:col-span-2">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Posições abertas
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="text-left px-4 py-2.5 font-medium">Símbolo</th>
                              <th className="text-left px-4 py-2.5 font-medium">Dir.</th>
                              <th className="text-right px-4 py-2.5 font-medium">Volume</th>
                              <th className="text-right px-4 py-2.5 font-medium">P. Entrada</th>
                              <th className="text-right px-4 py-2.5 font-medium">P. Atual</th>
                              <th className="text-right px-4 py-2.5 font-medium">Lucro</th>
                              <th className="text-right px-4 py-2.5 font-medium">Swap</th>
                              <th className="text-right px-4 py-2.5 font-medium">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {portfolio.posicoes.length === 0 && (
                              <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Sem posições abertas</td></tr>
                            )}
                            {portfolio.posicoes.map((p: any) => (
                              <tr key={p.orderId} className="hover:bg-muted/30 transition-colors">
                                <td className="px-4 py-2.5">
                                  <p className="font-semibold">{p.simbolo}</p>
                                  <p className="text-xs text-muted-foreground truncate max-w-[140px]">{p.descricao}</p>
                                </td>
                                <td className="px-4 py-2.5">
                                  <Badge variant={p.direcao === "BUY" ? "default" : "destructive"} className="text-xs">
                                    {p.direcao}
                                  </Badge>
                                </td>
                                <td className="px-4 py-2.5 text-right">{p.volume}</td>
                                <td className="px-4 py-2.5 text-right font-mono text-xs">{p.precoEntrada?.toFixed(p.digits ?? 4)}</td>
                                <td className="px-4 py-2.5 text-right font-mono text-xs">
                                  {p.precoAtual ? p.precoAtual.toFixed(p.digits ?? 4) : "—"}
                                </td>
                                <td className={cn("px-4 py-2.5 text-right font-medium", p.lucro >= 0 ? "text-emerald-500" : "text-red-500")}>
                                  {formatCurrency(p.lucro)}
                                </td>
                                <td className={cn("px-4 py-2.5 text-right text-xs", p.swap < 0 ? "text-red-400" : "text-muted-foreground")}>
                                  {formatCurrency(p.swap)}
                                </td>
                                <td className={cn("px-4 py-2.5 text-right font-bold", p.lucroTotal >= 0 ? "text-emerald-500" : "text-red-500")}>
                                  {formatCurrency(p.lucroTotal)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Bar chart lucro por símbolo */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Lucro por símbolo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {lucroPorSimbolo.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">Sem posições</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={lucroPorSimbolo} layout="vertical" barSize={14}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                          <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v)} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
                          <Tooltip formatter={(v: any) => formatCurrency(v)} />
                          <Bar dataKey="lucro" name="Lucro" radius={[0, 3, 3, 0]}>
                            {lucroPorSimbolo.map((p: any, i: number) => (
                              <Cell key={i} fill={p.lucro >= 0 ? "#10b981" : "#ef4444"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </>
      )}

      {/* ── HISTÓRICO ───────────────────────────────────────────── */}
      {activeTab === "historico" && (
        <>
          {/* Filtro dias */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Período:</span>
            {[30, 90, 180, 365].map((d) => (
              <button
                key={d}
                onClick={() => setDias(d)}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium border transition-colors",
                  dias === d ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {d === 365 ? "1 ano" : `${d}d`}
              </button>
            ))}
          </div>

          {loadingH && (
            <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span>A carregar histórico...</span>
            </div>
          )}
          {errorH && !loadingH && (
            <Card>
              <CardContent className="py-8 text-center">
                <AlertCircle className="h-8 w-8 mx-auto text-red-500 mb-2" />
                <p className="font-medium text-red-500">{errorH}</p>
              </CardContent>
            </Card>
          )}
          {historico && !loadingH && (
            <>
              {/* KPIs histórico */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <XtbKpi label="Trades fechados" value={String(historico.resumo.total)} />
                <XtbKpi
                  label="Lucro total"
                  value={formatCurrency(historico.resumo.totalLucro)}
                  color={historico.resumo.totalLucro >= 0 ? "text-emerald-500" : "text-red-500"}
                />
                <XtbKpi
                  label="Taxa de sucesso"
                  value={`${historico.resumo.taxaSucesso.toFixed(1)}%`}
                  color={historico.resumo.taxaSucesso >= 50 ? "text-emerald-500" : "text-red-500"}
                />
                <XtbKpi
                  label="Lucro médio"
                  value={formatCurrency(historico.resumo.lucroMedio)}
                  color={historico.resumo.lucroMedio >= 0 ? "text-emerald-500" : "text-red-500"}
                />
              </div>

              {/* Melhor/Pior */}
              {(historico.resumo.melhorTrade || historico.resumo.piorTrade) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {historico.resumo.melhorTrade && (
                    <Card className="border-emerald-200 dark:border-emerald-800">
                      <CardContent className="pt-4 pb-4">
                        <p className="text-xs text-emerald-600 font-semibold uppercase mb-1">Melhor trade</p>
                        <p className="font-bold">{historico.resumo.melhorTrade.simbolo} <span className="text-emerald-500">{formatCurrency(historico.resumo.melhorTrade.lucroTotal)}</span></p>
                        <p className="text-xs text-muted-foreground">{historico.resumo.melhorTrade.direcao} · {historico.resumo.melhorTrade.volume} lotes</p>
                      </CardContent>
                    </Card>
                  )}
                  {historico.resumo.piorTrade && (
                    <Card className="border-red-200 dark:border-red-800">
                      <CardContent className="pt-4 pb-4">
                        <p className="text-xs text-red-500 font-semibold uppercase mb-1">Pior trade</p>
                        <p className="font-bold">{historico.resumo.piorTrade.simbolo} <span className="text-red-500">{formatCurrency(historico.resumo.piorTrade.lucroTotal)}</span></p>
                        <p className="text-xs text-muted-foreground">{historico.resumo.piorTrade.direcao} · {historico.resumo.piorTrade.volume} lotes</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Bar por símbolo */}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">P&L por símbolo</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={histBarData} layout="vertical" barSize={12}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                        <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v)} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
                        <Tooltip formatter={(v: any) => formatCurrency(v)} />
                        <Bar dataKey="lucro" name="P&L" radius={[0, 3, 3, 0]}>
                          {histBarData.map((p, i) => (
                            <Cell key={i} fill={(p.lucro as number) >= 0 ? "#10b981" : "#ef4444"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Tabela resumo */}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Últimas operações</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-y-auto max-h-[320px]">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-background border-b">
                          <tr>
                            <th className="text-left px-4 py-2 font-medium">Símbolo</th>
                            <th className="text-left px-4 py-2 font-medium">Dir.</th>
                            <th className="text-right px-4 py-2 font-medium">Fecho</th>
                            <th className="text-right px-4 py-2 font-medium">P&L</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {historico.trades.slice(0, 40).map((t: any) => (
                            <tr key={t.orderId} className="hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-2 font-medium">{t.simbolo}</td>
                              <td className="px-4 py-2">
                                <Badge variant={t.direcao === "BUY" ? "default" : "destructive"} className="text-xs">{t.direcao}</Badge>
                              </td>
                              <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                                {t.dataFecho ? format(new Date(t.dataFecho), "dd/MM/yy HH:mm") : "—"}
                              </td>
                              <td className={cn("px-4 py-2 text-right font-semibold", t.lucroTotal >= 0 ? "text-emerald-500" : "text-red-500")}>
                                {formatCurrency(t.lucroTotal)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function InvestimentosPage() {
  const [investimentos, setInvestimentos] = useState<any[]>([]);
  const [resumo, setResumo] = useState<any>(null);
  const [projecao, setProjecao] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [opFor, setOpFor] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [updateResult, setUpdateResult] = useState<any>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = () => Promise.all([
    fetch("/api/investimentos").then((r) => r.json()).then((d) => setInvestimentos(d.data ?? [])),
    fetch("/api/investimentos/resumo").then((r) => r.json()).then((d) => setResumo(d.data)),
    fetch("/api/investimentos/projecao?anos=20").then((r) => r.json()).then((d) => setProjecao(d.data ?? [])),
    fetch("/api/contas").then((r) => r.json()).then((d) => setContas(d.data ?? [])),
  ]);

  useEffect(() => { load(); }, []);

  const atualizarPrecos = async () => {
    setAtualizando(true);
    setUpdateResult(null);
    try {
      const r = await fetch("/api/investimentos/atualizar-precos", { method: "POST" });
      const d = await r.json();
      setUpdateResult(d.data);
      await load();
    } finally {
      setAtualizando(false);
    }
  };

  const deleteInvestimento = async (id: string) => {
    await fetch(`/api/investimentos/${id}`, { method: "DELETE" });
    setConfirmDeleteId(null);
    load();
  };

  const alocacao = Object.entries(resumo?.porTipo ?? {}).map(([nome, valor], i) => ({ nome, valor, fill: CORES[i % CORES.length] }));
  const projecaoBase = projecao.find((s: any) => s.label === "base")?.rows ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Investimentos</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={atualizarPrecos} disabled={atualizando} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", atualizando && "animate-spin")} />
            {atualizando ? "A atualizar..." : "Atualizar preços"}
          </Button>
          <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />Novo ativo</Button>
        </div>
      </div>

      {updateResult && (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border bg-muted/40 text-sm">
          <span className="font-medium text-emerald-600">{updateResult.atualizados}/{updateResult.total} preços atualizados</span>
          {updateResult.taxas && (
            <span className="text-xs text-muted-foreground">
              USD/EUR: {updateResult.taxas.usdEur} · GBP/EUR: {updateResult.taxas.gbpEur}
            </span>
          )}
          {updateResult.resultados.filter((r: any) => r.erro).map((r: any) => (
            <span key={r.ticker} className="text-xs text-red-500">{r.ticker}: {r.erro}</span>
          ))}
          <button onClick={() => setUpdateResult(null)} className="ml-auto text-xs text-muted-foreground hover:text-foreground">✕</button>
        </div>
      )}

      {resumo && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Valor total</p><p className="text-2xl font-bold">{formatCurrency(resumo.valorTotal)}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Custo total</p><p className="text-2xl font-bold">{formatCurrency(resumo.custoTotal)}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Ganho/Perda preço</p><p className={cn("text-2xl font-bold", resumo.ganhoPerda >= 0 ? "text-green-600" : "text-red-500")}>{formatCurrency(resumo.ganhoPerda)}</p><p className="text-xs text-muted-foreground mt-1">{resumo.ganhoPerdaPercent.toFixed(2)}%</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Dividendos recebidos</p><p className="text-2xl font-bold text-emerald-500">{formatCurrency(resumo.totalDividendos)}</p><p className="text-xs text-muted-foreground mt-1">total histórico</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Rentabilidade/ano</p><p className={cn("text-2xl font-bold", resumo.totalReturnAnualizado >= 0 ? "text-green-600" : "text-red-500")}>{resumo.totalReturnAnualizado.toFixed(2)}%<span className="text-sm font-normal">/ano</span></p><p className="text-xs text-muted-foreground mt-1">CAGR · {resumo.anosInvestido}a investido</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Rentabilidade total</p><p className={cn("text-2xl font-bold", resumo.totalReturnPercent >= 0 ? "text-green-600" : "text-red-500")}>{resumo.totalReturnPercent.toFixed(2)}%</p><p className="text-xs text-muted-foreground mt-1">desde início</p></CardContent></Card>
        </div>
      )}

      <Tabs defaultValue="carteira">
        <TabsList>
          <TabsTrigger value="carteira">Carteira</TabsTrigger>
          <TabsTrigger value="dividendos">Dividendos</TabsTrigger>
          <TabsTrigger value="movimentos">Movimentos</TabsTrigger>
          <TabsTrigger value="importar-xtb">Importar XTB</TabsTrigger>
          <TabsTrigger value="projecao">Projeção</TabsTrigger>
        </TabsList>

        <TabsContent value="carteira" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    {["Nome", "Tipo", "Qtd", "P. Médio", "Atual", "Total", "G/P", "%"].map((h) => (
                      <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>
                    ))}
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {investimentos.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Sem ativos</td></tr>}
                  {investimentos.map((i: any) => (
                    <tr key={i.id} className="hover:bg-muted/50">
                      <td className="px-3 py-2 font-medium">{i.ticker}<span className="block text-xs text-muted-foreground">{i.nome}</span></td>
                      <td className="px-3 py-2 text-muted-foreground">{i.tipo}</td>
                      <td className="px-3 py-2">{toNumber(i.quantidade)}</td>
                      <td className="px-3 py-2">{formatCurrency(toNumber(i.precoMedioCompra))}</td>
                      <td className="px-3 py-2">{formatCurrency(toNumber(i.valorAtualUnidade))}</td>
                      <td className="px-3 py-2 font-medium">{formatCurrency(i.valorTotal)}</td>
                      <td className={cn("px-3 py-2", i.ganhoPerda >= 0 ? "text-green-600" : "text-red-500")}>{formatCurrency(i.ganhoPerda)}</td>
                      <td className={cn("px-3 py-2", i.ganhoPerda >= 0 ? "text-green-600" : "text-red-500")}>{i.custo > 0 ? ((i.ganhoPerda / i.custo) * 100).toFixed(1) : 0}%</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(i); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setOpFor(i.id)}>Op.</Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => setConfirmDeleteId(i.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">Alocação</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={alocacao} dataKey="valor" nameKey="nome" cx="50%" cy="50%" outerRadius={70}>
                      {alocacao.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2">
                  {alocacao.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: a.fill }} />
                      <span>{a.nome}</span>
                      <span className="ml-auto text-muted-foreground">{formatCurrency(a.valor as number)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="dividendos">
          <DividendosPanel investimentos={investimentos} />
        </TabsContent>

        <TabsContent value="movimentos">
          <MovimentosInvestimentoPanel />
        </TabsContent>

        <TabsContent value="importar-xtb">
          <XtbImportPanel onDone={load} />
        </TabsContent>

        <TabsContent value="projecao">
          <Card>
            <CardHeader><CardTitle className="text-base">Projeção de crescimento (20 anos)</CardTitle></CardHeader>
            <CardContent>
              {projecaoBase.length === 0 ? <p className="text-muted-foreground text-sm">Sem dados suficientes</p> : (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={projecaoBase}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="ano" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: any) => `${(Number(v) / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: any) => formatCurrency(v)} />
                      <Line type="monotone" dataKey="valorCarteira" name="Valor" stroke="#3b82f6" dot={false} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-muted-foreground mt-3">Estimativa baseada em dados históricos. Não constitui aconselhamento financeiro.</p>
                  <div className="overflow-x-auto mt-4">
                    <table className="w-full text-xs">
                      <thead className="bg-muted">
                        <tr>{["Ano", "Valor", "Contribuições", "Dividendos", "Rendimento", "Ganho acum."].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y">
                        {projecaoBase.filter((_: any, i: number) => i % 5 === 4 || i === 0).map((r: any) => (
                          <tr key={r.ano} className="hover:bg-muted/50">
                            <td className="px-3 py-2 font-medium">{r.ano}</td>
                            <td className="px-3 py-2">{formatCurrency(r.valorCarteira)}</td>
                            <td className="px-3 py-2">{formatCurrency(r.contribuicoesAno)}</td>
                            <td className="px-3 py-2">{formatCurrency(r.dividendosAno)}</td>
                            <td className="px-3 py-2">{formatCurrency(r.rendimentoAno)}</td>
                            <td className="px-3 py-2 text-green-600">{formatCurrency(r.ganhoAcumulado)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar ativo" : "Novo ativo"}</DialogTitle></DialogHeader>
          <InvForm initial={editing} onSave={() => { setOpen(false); load(); }} onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!opFor} onOpenChange={(o) => !o && setOpFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registar operação</DialogTitle></DialogHeader>
          {opFor && <OpForm investmentId={opFor} contas={contas} onSave={() => { setOpFor(null); load(); }} onClose={() => setOpFor(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDeleteId} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Eliminar ativo</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tens a certeza que queres eliminar este ativo? Esta ação também elimina todo o histórico de operações associado.
          </p>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => confirmDeleteId && deleteInvestimento(confirmDeleteId)}>
              <Trash2 className="h-4 w-4 mr-2" />Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
