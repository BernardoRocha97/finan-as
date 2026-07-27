"use client";
import { useEffect, useState, useCallback } from "react";
import { formatCurrency, toNumber, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoneyInput } from "@/components/ui/MoneyInput";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import {
  ChevronLeft, ChevronRight, Plus, Pencil, Trash2,
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Clock, Target,
} from "lucide-react";
import { format, subMonths, addMonths, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import Link from "next/link";

// ── Budget form ────────────────────────────────────────────────────────────────

function BudgetForm({ initial, categorias, onSave, onClose }: any) {
  const isSugestao = !initial?.id && (initial?.valorAlvo ?? 0) > 0;
  const [form, setForm] = useState({
    nome: initial?.nome ?? "",
    valorAlvo: toNumber(initial?.valorAlvo) || 0,
    cor: initial?.cor ?? "#3b82f6",
    categoryId: initial?.categoria?.id ?? "",
  });
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    const method = initial?.id ? "PUT" : "POST";
    const url = initial?.id ? `/api/objetivos/${initial.id}` : "/api/objetivos";
    await fetch(url, {
      method, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: form.nome, tipo: "ORCAMENTO_MENSAL",
        valorAlvo: form.valorAlvo, cor: form.cor,
        categoryId: form.categoryId || null,
      }),
    });
    setLoading(false);
    onSave();
  };

  const CORES = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#ec4899"];

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Nome</Label>
        <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Restaurantes" />
      </div>
      {isSugestao && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
          <TrendingUp className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>Sugestão baseada na média dos últimos 3 meses. Podes ajustar o valor.</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Limite mensal (€)</Label>
          <MoneyInput value={form.valorAlvo} onChange={(v) => setForm({ ...form, valorAlvo: v })} />
        </div>
        <div className="space-y-1">
          <Label>Categoria (opcional)</Label>
          <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
            <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Sem categoria</SelectItem>
              {categorias.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label>Cor</Label>
        <div className="flex gap-2 flex-wrap">
          {CORES.map((c) => (
            <button key={c} onClick={() => setForm({ ...form, cor: c })}
              className={cn("h-7 w-7 rounded-full border-2 transition-all", form.cor === c ? "border-foreground scale-110" : "border-transparent")}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} disabled={loading || !form.nome || !form.valorAlvo}>
          {loading ? "A guardar..." : "Guardar"}
        </Button>
      </div>
    </div>
  );
}

// ── Budget card ────────────────────────────────────────────────────────────────

function OrcamentoCard({ orc, onEdit, onDelete }: { orc: any; onEdit: () => void; onDelete: () => void }) {
  const { limite, gastoMes, pct, projecaoFimMes, mediaUlt3m, historico, diaAtual, diasMes } = orc;
  const excedido = gastoMes > limite;
  const projecaoExcede = projecaoFimMes > limite;
  const restante = limite - gastoMes;
  const burnDiario = diaAtual > 0 ? gastoMes / diaAtual : 0;
  const diasRestantes = diasMes - diaAtual;

  const barColor = pct < 70 ? "#10b981" : pct < 90 ? "#f59e0b" : "#ef4444";

  const StatusIcon = excedido
    ? <AlertTriangle className="h-4 w-4 text-red-500" />
    : pct >= 90
    ? <AlertTriangle className="h-4 w-4 text-amber-500" />
    : pct >= 70
    ? <Clock className="h-4 w-4 text-amber-500" />
    : <CheckCircle2 className="h-4 w-4 text-emerald-500" />;

  // Chart data: 3 months history + current
  const chartData = [
    ...historico.map((h: any) => ({ label: h.mes, gasto: h.gasto, limite })),
    { label: "Este mês", gasto: gastoMes, limite, projecao: projecaoFimMes },
  ];

  return (
    <Card className={cn("relative overflow-hidden", excedido && "border-red-300 dark:border-red-700")}>
      <div className="absolute top-0 left-0 bottom-0 w-1 rounded-l-lg" style={{ backgroundColor: orc.cor }} />
      <CardContent className="pt-4 pb-4 pl-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {StatusIcon}
              <p className="font-semibold truncate">{orc.nome}</p>
            </div>
            {orc.categoria && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: orc.categoria.cor }} />
                <span className="text-xs text-muted-foreground">{orc.categoria.nome}</span>
              </div>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            <Button size="sm" variant="outline" className="h-7 px-2" onClick={onEdit}><Pencil className="h-3 w-3" /></Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-red-500 hover:text-red-600" onClick={onDelete}><Trash2 className="h-3 w-3" /></Button>
          </div>
        </div>

        {/* Amounts */}
        <div className="flex items-end justify-between mb-1.5">
          <div>
            <span className={cn("text-2xl font-bold", excedido ? "text-red-500" : "")}>{formatCurrency(gastoMes)}</span>
            <span className="text-sm text-muted-foreground ml-1.5">/ {formatCurrency(limite)}</span>
          </div>
          <span className={cn("text-sm font-semibold", excedido ? "text-red-500" : pct >= 90 ? "text-amber-500" : "text-muted-foreground")}>
            {pct.toFixed(0)}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2.5 rounded-full bg-muted overflow-hidden mb-3">
          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }} />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 text-xs mb-3">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-muted-foreground">Resta</p>
            <p className={cn("font-semibold mt-0.5", excedido ? "text-red-500" : "text-foreground")}>
              {excedido ? `-${formatCurrency(Math.abs(restante))}` : formatCurrency(restante)}
            </p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-muted-foreground">Diário</p>
            <p className="font-semibold mt-0.5">{formatCurrency(burnDiario)}</p>
          </div>
          <div className={cn("text-center p-2 rounded-lg", projecaoExcede ? "bg-red-50 dark:bg-red-950/30" : "bg-muted/50")}>
            <p className={cn("text-muted-foreground", projecaoExcede && "text-red-500")}>Projeção</p>
            <p className={cn("font-semibold mt-0.5", projecaoExcede ? "text-red-500" : "text-foreground")}>
              {formatCurrency(projecaoFimMes)}
            </p>
          </div>
        </div>

        {/* Mini bar chart: 3 months + current */}
        <ResponsiveContainer width="100%" height={70}>
          <BarChart data={chartData} barSize={16} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              formatter={(v: any, name: string) => [formatCurrency(v), name === "gasto" ? "Gasto" : name === "projecao" ? "Projeção" : "Limite"]}
              contentStyle={{ fontSize: 11 }}
            />
            <ReferenceLine y={limite} stroke={orc.cor} strokeDasharray="3 3" strokeWidth={1} />
            <Bar dataKey="gasto" name="Gasto" radius={[2, 2, 0, 0]}>
              {chartData.map((d: any, i: number) => (
                <Cell key={i} fill={d.gasto > limite ? "#ef4444" : d.gasto / limite > 0.9 ? "#f59e0b" : orc.cor} fillOpacity={i === chartData.length - 1 ? 1 : 0.5} />
              ))}
            </Bar>
            {chartData.some((d: any) => d.projecao) && (
              <Bar dataKey="projecao" name="Projeção" fill={projecaoExcede ? "#ef444450" : `${orc.cor}40`} radius={[2, 2, 0, 0]} />
            )}
          </BarChart>
        </ResponsiveContainer>

        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>Média 3m: {formatCurrency(mediaUlt3m)}</span>
          <span>Dia {diaAtual}/{diasMes}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrcamentoPage() {
  const [mes, setMes] = useState(format(new Date(), "yyyy-MM"));
  const [data, setData] = useState<any>(null);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async (m: string) => {
    setLoading(true);
    const res = await fetch(`/api/orcamento/resumo?mes=${m}`).then((r) => r.json());
    setData(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(mes); }, [mes, load]);
  useEffect(() => {
    fetch("/api/categorias").then((r) => r.json()).then((d) => setCategorias(d.data ?? []));
  }, []);

  const navMes = (dir: number) => {
    const base = parseISO(`${mes}-01`);
    setMes(format(dir > 0 ? addMonths(base, 1) : subMonths(base, 1), "yyyy-MM"));
  };

  const deleteOrc = async (id: string) => {
    await fetch(`/api/objetivos/${id}`, { method: "DELETE" });
    setConfirmDelete(null);
    load(mes);
  };

  const totais = data?.totais ?? {};
  const orcamentos: any[] = data?.orcamentos ?? [];
  const unbudgeted: any[] = data?.unbudgeted ?? [];
  const isCurrentMonth = data?.isCurrentMonth ?? true;

  const totalPct = totais.pct ?? 0;
  const totalColor = totalPct >= 100 ? "text-red-500" : totalPct >= 90 ? "text-amber-500" : "text-emerald-500";

  // Bar chart — todos os orçamentos lado a lado
  const overviewData = orcamentos.map((o) => ({
    nome: o.nome.length > 12 ? o.nome.slice(0, 12) + "…" : o.nome,
    gasto: o.gastoMes,
    limite: o.limite,
    restante: Math.max(0, o.limite - o.gastoMes),
    excedido: Math.max(0, o.gastoMes - o.limite),
    cor: o.cor,
  }));

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Orçamento</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Controlo de despesas por categoria</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Month nav */}
          <div className="flex items-center gap-1 border rounded-lg p-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => navMes(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium px-2 capitalize min-w-[120px] text-center">
              {data ? format(parseISO(`${mes}-01`), "MMMM yyyy", { locale: pt }) : "—"}
            </span>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => navMes(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button size="sm" onClick={() => { setEditing(null); setOpenForm(true); }} className="gap-1.5">
            <Plus className="h-4 w-4" /> Novo orçamento
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">A carregar...</p>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total gasto</p>
                <p className={cn("text-2xl font-bold mt-1", totalColor)}>{formatCurrency(totais.totalGasto)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">de {formatCurrency(totais.totalLimite)} orçamentado</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Utilização</p>
                <p className={cn("text-2xl font-bold mt-1", totalColor)}>{totalPct.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {totalPct >= 100 ? "Orçamento excedido" : `Resta ${formatCurrency(totais.totalLimite - totais.totalGasto)}`}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Projeção fim mês</p>
                <p className={cn("text-2xl font-bold mt-1", totais.totalProjecao > totais.totalLimite ? "text-red-500" : "text-foreground")}>
                  {formatCurrency(totais.totalProjecao)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isCurrentMonth ? `Dia ${data?.diaAtual}/${data?.diasMes}` : "Mês encerrado"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
                <div className="mt-1 space-y-0.5">
                  <p className="text-sm font-medium text-emerald-500">
                    ✓ {orcamentos.filter((o) => o.pct < 70).length} em dia
                  </p>
                  <p className="text-sm font-medium text-amber-500">
                    ⚠ {orcamentos.filter((o) => o.pct >= 70 && o.pct < 100).length} a aproximar
                  </p>
                  <p className="text-sm font-medium text-red-500">
                    ✗ {orcamentos.filter((o) => o.pct >= 100).length} excedidos
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Overview chart */}
          {orcamentos.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Resumo — gasto vs limite</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={overviewData} barGap={4} barSize={20}>
                    <XAxis dataKey="nome" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={36} />
                    <Tooltip formatter={(v: any, name: string) => [formatCurrency(v), name === "gasto" ? "Gasto" : name === "restante" ? "Restante" : "Excedido"]} />
                    <Bar dataKey="gasto" name="Gasto" radius={[2, 2, 0, 0]} stackId="a">
                      {overviewData.map((d, i) => <Cell key={i} fill={d.excedido > 0 ? "#ef4444" : d.gasto / d.limite > 0.9 ? "#f59e0b" : d.cor} />)}
                    </Bar>
                    <Bar dataKey="restante" name="Restante" fill="#e5e7eb" radius={[2, 2, 0, 0]} stackId="a" />
                    <Bar dataKey="excedido" name="Excedido" fill="#ef444450" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Budget cards grid */}
          {orcamentos.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Target className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                <p className="text-muted-foreground mb-4">Ainda não tens orçamentos definidos.</p>
                <Button onClick={() => { setEditing(null); setOpenForm(true); }} className="gap-1.5">
                  <Plus className="h-4 w-4" /> Criar primeiro orçamento
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
              {orcamentos.map((orc) => (
                <OrcamentoCard key={orc.id} orc={orc}
                  onEdit={() => { setEditing(orc); setOpenForm(true); }}
                  onDelete={() => setConfirmDelete(orc.id)} />
              ))}
            </div>
          )}

          {/* Categorias sem orçamento */}
          {unbudgeted.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Categorias sem orçamento</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">Clica em + para criar orçamento com sugestão baseada na média</p>
                  </div>
                  <Badge variant="outline" className="text-xs">{unbudgeted.length} categorias</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {unbudgeted.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/40 transition-colors group">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: c.cor }} />
                        <span className="text-sm font-medium truncate">{c.nome}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">este mês</p>
                          <p className="text-sm font-semibold">{formatCurrency(c.gastoMes)}</p>
                        </div>
                        {c.mediaUlt3m > 0 && (
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">média 3m</p>
                            <p className="text-sm font-semibold text-blue-500">{formatCurrency(c.mediaUlt3m)}</p>
                          </div>
                        )}
                        <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-xs"
                          onClick={() => {
                            setEditing({ nome: c.nome, cor: c.cor, categoria: { id: c.id }, valorAlvo: c.mediaUlt3m || c.gastoMes });
                            setOpenForm(true);
                          }}>
                          <Plus className="h-3 w-3" /> Definir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Form dialog */}
      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar orçamento" : "Novo orçamento"}</DialogTitle>
          </DialogHeader>
          <BudgetForm
            initial={editing}
            categorias={categorias}
            onSave={() => { setOpenForm(false); load(mes); }}
            onClose={() => setOpenForm(false)} />
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Eliminar orçamento?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Esta acção não pode ser desfeita.</p>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => confirmDelete && deleteOrc(confirmDelete)}>Eliminar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
