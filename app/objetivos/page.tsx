"use client";
import { useEffect, useState } from "react";
import { formatCurrency, toNumber, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Target, Plus, PiggyBank, Pencil, Trash2, TrendingUp, CheckCircle2, Clock, AlertTriangle, BarChart3, CalendarDays } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { format, differenceInDays, differenceInMonths, addMonths, isAfter } from "date-fns";
import { pt } from "date-fns/locale";

// ── Circular progress ─────────────────────────────────────────────────────────
function CircularProgress({ pct, cor, size = 80 }: { pct: number; cor: string; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(pct / 100, 1) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={6} className="text-muted/40" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={cor} strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.6s ease" }} />
    </svg>
  );
}

// ── Goal form ─────────────────────────────────────────────────────────────────
function GoalForm({ initial, categorias, onSave, onClose }: any) {
  const [form, setForm] = useState({
    nome: "", tipo: "POUPANCA", valorAlvo: 0, cor: "#10b981", icone: "target", notas: "",
    categoryId: "", dataLimite: "",
    ...initial,
    valorAlvo: toNumber(initial?.valorAlvo) || 0,
    dataLimite: initial?.dataLimite ? new Date(initial.dataLimite).toISOString().slice(0, 10) : "",
  });
  const [loading, setLoading] = useState(false);
  const save = async () => {
    setLoading(true);
    const method = initial?.id ? "PUT" : "POST";
    const url = initial?.id ? `/api/objetivos/${initial.id}` : "/api/objetivos";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      nome: form.nome, tipo: form.tipo, valorAlvo: form.valorAlvo, cor: form.cor,
      icone: form.icone, notas: form.notas,
      categoryId: form.categoryId || null,
      dataLimite: form.dataLimite || null,
    }) });
    setLoading(false); onSave();
  };
  return (
    <div className="space-y-4">
      <div className="space-y-1"><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1"><Label>Tipo</Label>
          <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="POUPANCA">Poupança</SelectItem>
              <SelectItem value="ORCAMENTO_MENSAL">Orçamento mensal</SelectItem>
              <SelectItem value="ORCAMENTO_ANUAL">Orçamento anual</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>Valor {form.tipo === "POUPANCA" ? "alvo" : "limite"} (€)</Label>
          <MoneyInput value={form.valorAlvo} onChange={(v) => setForm({ ...form, valorAlvo: v })} />
        </div>
      </div>
      {form.tipo === "POUPANCA" && (
        <div className="space-y-1"><Label>Data limite (opcional)</Label>
          <Input type="date" value={form.dataLimite} onChange={(e) => setForm({ ...form, dataLimite: e.target.value })} />
        </div>
      )}
      {(form.tipo === "ORCAMENTO_MENSAL" || form.tipo === "ORCAMENTO_ANUAL") && (
        <div className="space-y-1"><Label>Categoria</Label>
          <Select value={form.categoryId ?? ""} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
            <SelectTrigger><SelectValue placeholder="Selecionar categoria" /></SelectTrigger>
            <SelectContent>{categorias.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-1"><Label>Cor</Label>
        <div className="flex gap-2 flex-wrap">
          {["#10b981","#3b82f6","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#84cc16"].map((c) => (
            <button key={c} onClick={() => setForm({ ...form, cor: c })}
              className={cn("h-7 w-7 rounded-full border-2 transition-all", form.cor === c ? "border-foreground scale-110" : "border-transparent")}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} disabled={loading || !form.nome || !form.valorAlvo}>{loading ? "A guardar..." : "Guardar"}</Button>
      </DialogFooter>
    </div>
  );
}

// ── Contribution form ─────────────────────────────────────────────────────────
function ContribForm({ goal, onSave, onClose }: any) {
  const restante = toNumber(goal.valorAlvo) - toNumber(goal.valorAtual);
  const [form, setForm] = useState({ valor: 0, data: new Date().toISOString().slice(0, 10), notas: "" });
  const [loading, setLoading] = useState(false);
  const save = async () => {
    setLoading(true);
    await fetch(`/api/objetivos/${goal.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setLoading(false); onSave();
  };
  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
        <div className="flex justify-between"><span className="text-muted-foreground">Poupado</span><span className="font-medium">{formatCurrency(toNumber(goal.valorAtual))}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Alvo</span><span className="font-medium">{formatCurrency(toNumber(goal.valorAlvo))}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Ainda falta</span><span className="font-semibold text-primary">{formatCurrency(restante)}</span></div>
      </div>
      <div className="space-y-1"><Label>Valor a adicionar (€)</Label><MoneyInput value={form.valor} onChange={(v) => setForm({ ...form, valor: v })} /></div>
      <div className="space-y-1"><Label>Data</Label><Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
      <div className="space-y-1"><Label>Notas</Label><Input value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} placeholder="Opcional" /></div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} disabled={loading || !form.valor}>{loading ? "A registar..." : "Adicionar"}</Button>
      </DialogFooter>
    </div>
  );
}

// ── Savings goal card ─────────────────────────────────────────────────────────
function PoupancaCard({ obj, onEdit, onContrib, onDelete }: any) {
  const pct = Math.min(100, (toNumber(obj.valorAtual) / toNumber(obj.valorAlvo)) * 100);
  const restante = toNumber(obj.valorAlvo) - toNumber(obj.valorAtual);
  const concluido = pct >= 100;

  // Time remaining
  let diasRestantes: number | null = null;
  let mesesRestantes: number | null = null;
  let mensalidadeNecessaria: number | null = null;
  let statusLabel = "";
  let statusColor = "";

  if (obj.dataLimite) {
    const limite = new Date(obj.dataLimite);
    const hoje = new Date();
    diasRestantes = differenceInDays(limite, hoje);
    mesesRestantes = Math.max(0, differenceInMonths(limite, hoje));
    if (!concluido && mesesRestantes > 0) mensalidadeNecessaria = restante / mesesRestantes;

    if (concluido) { statusLabel = "Concluído"; statusColor = "text-emerald-500"; }
    else if (diasRestantes < 0) { statusLabel = "Em atraso"; statusColor = "text-red-500"; }
    else if (diasRestantes < 60) { statusLabel = `${diasRestantes}d restantes`; statusColor = "text-amber-500"; }
    else { statusLabel = `${mesesRestantes}m restantes`; statusColor = "text-muted-foreground"; }
  } else if (concluido) {
    statusLabel = "Concluído"; statusColor = "text-emerald-500";
  }

  return (
    <Card className={cn("relative overflow-hidden", concluido && "border-emerald-200 dark:border-emerald-800")}>
      {concluido && <div className="absolute inset-0 bg-emerald-500/5 pointer-events-none" />}
      <div className="absolute top-0 left-0 bottom-0 w-1 rounded-l-lg" style={{ backgroundColor: obj.cor }} />
      <CardContent className="pt-4 pb-4 pl-5">
        <div className="flex items-start justify-between gap-3">
          {/* Circular + info */}
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <CircularProgress pct={pct} cor={obj.cor} size={72} />
              <div className="absolute inset-0 flex items-center justify-center">
                {concluido
                  ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  : <span className="text-xs font-bold">{pct.toFixed(0)}%</span>}
              </div>
            </div>
            <div>
              <p className="font-semibold text-sm leading-tight">{obj.nome}</p>
              <p className="text-xl font-bold mt-0.5">{formatCurrency(toNumber(obj.valorAtual))}</p>
              <p className="text-xs text-muted-foreground">de {formatCurrency(toNumber(obj.valorAlvo))}</p>
              {statusLabel && <p className={cn("text-xs font-medium mt-1", statusColor)}>{statusLabel}</p>}
            </div>
          </div>
          {/* Actions */}
          <div className="flex flex-col gap-1 shrink-0">
            <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={onEdit}><Pencil className="h-3 w-3" /></Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-red-500 hover:text-red-600" onClick={onDelete}><Trash2 className="h-3 w-3" /></Button>
          </div>
        </div>

        {/* Details */}
        {!concluido && (
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Falta</span>
              <span className="font-medium">{formatCurrency(restante)}</span>
            </div>
            {mensalidadeNecessaria !== null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Precisa/mês</span>
                <span className="font-medium text-primary">{formatCurrency(mensalidadeNecessaria)}</span>
              </div>
            )}
            {obj.dataLimite && (
              <div className="flex justify-between col-span-2">
                <span className="text-muted-foreground">Data limite</span>
                <span className="font-medium">{format(new Date(obj.dataLimite), "dd MMM yyyy", { locale: pt })}</span>
              </div>
            )}
          </div>
        )}

        {/* Contribuições recentes */}
        {obj.contribuicoes?.length > 0 && (
          <div className="mt-3 pt-3 border-t space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Últimas contribuições</p>
            {obj.contribuicoes.slice(0, 3).map((c: any) => (
              <div key={c.id} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{format(new Date(c.data), "dd/MM/yy")}</span>
                <span className="font-medium text-emerald-500">+{formatCurrency(toNumber(c.valor))}</span>
              </div>
            ))}
          </div>
        )}

        <Button size="sm" className="w-full mt-3 h-8 text-xs" style={{ backgroundColor: obj.cor, color: "#fff" }} onClick={onContrib}>
          <Plus className="h-3.5 w-3.5 mr-1" />Adicionar poupança
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Budget card ───────────────────────────────────────────────────────────────
function OrcamentoCard({ obj, onEdit, onDelete }: any) {
  const gasto = toNumber(obj.valorAtual);
  const limite = toNumber(obj.valorAlvo);
  const pct = limite > 0 ? Math.min((gasto / limite) * 100, 100) : 0;
  const restante = limite - gasto;
  const excedido = gasto > limite;

  const cor = pct < 70 ? "#10b981" : pct < 90 ? "#f59e0b" : "#ef4444";
  const statusIcon = pct < 70
    ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    : pct < 90
    ? <Clock className="h-4 w-4 text-amber-500" />
    : <AlertTriangle className="h-4 w-4 text-red-500" />;

  return (
    <Card className={cn("relative", excedido && "border-red-200 dark:border-red-800")}>
      <div className="absolute top-0 left-0 bottom-0 w-1 rounded-l-lg" style={{ backgroundColor: cor }} />
      <CardContent className="pt-4 pb-4 pl-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {statusIcon}
              <p className="font-semibold text-sm truncate">{obj.nome}</p>
            </div>
            {obj.category && <p className="text-xs text-muted-foreground mt-0.5">{obj.category.nome}</p>}
          </div>
          <div className="flex gap-1 shrink-0 ml-2">
            <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={onEdit}><Pencil className="h-3 w-3" /></Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-red-500 hover:text-red-600" onClick={onDelete}><Trash2 className="h-3 w-3" /></Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="flex justify-between text-sm mb-1.5">
            <span className={cn("font-semibold", excedido && "text-red-500")}>{formatCurrency(gasto)}</span>
            <span className="text-muted-foreground">/ {formatCurrency(limite)}</span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cor }} />
          </div>
          <div className="flex justify-between mt-1.5 text-xs">
            <span style={{ color: cor }} className="font-medium">{pct.toFixed(0)}% utilizado</span>
            <span className={cn("font-medium", excedido ? "text-red-500" : "text-muted-foreground")}>
              {excedido ? `Excedido em ${formatCurrency(Math.abs(restante))}` : `Resta ${formatCurrency(restante)}`}
            </span>
          </div>
        </div>

        {/* Badge tipo */}
        <div className="mt-2">
          <Badge variant="outline" className="text-xs">{obj.tipo === "ORCAMENTO_MENSAL" ? "Mensal" : "Anual"}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ObjetivosPage() {
  const [objetivos, setObjetivos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [contribFor, setContribFor] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = () =>
    fetch("/api/objetivos").then((r) => r.json()).then((d) => setObjetivos(d.data ?? []));

  useEffect(() => {
    load();
    fetch("/api/categorias").then((r) => r.json()).then((d) => setCategorias(d.data ?? []));
  }, []);

  const deleteObj = async (id: string) => {
    await fetch(`/api/objetivos/${id}`, { method: "DELETE" });
    setConfirmDelete(null);
    load();
  };

  const poupancas = objetivos.filter((o) => o.tipo === "POUPANCA");
  const orcamentos = objetivos.filter((o) => o.tipo !== "POUPANCA");

  // Summary KPIs
  const totalPoupado = poupancas.reduce((s, o) => s + toNumber(o.valorAtual), 0);
  const totalAlvo = poupancas.reduce((s, o) => s + toNumber(o.valorAlvo), 0);
  const concluidos = poupancas.filter((o) => toNumber(o.valorAtual) >= toNumber(o.valorAlvo)).length;
  const orcamentosOk = orcamentos.filter((o) => {
    const pct = (toNumber(o.valorAtual) / toNumber(o.valorAlvo)) * 100;
    return pct < 90;
  }).length;

  // Bar chart for savings progress
  const barData = poupancas.map((o) => ({
    nome: o.nome.length > 14 ? o.nome.slice(0, 14) + "…" : o.nome,
    poupado: toNumber(o.valorAtual),
    falta: Math.max(0, toNumber(o.valorAlvo) - toNumber(o.valorAtual)),
    cor: o.cor,
  }));

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Objetivos</h1>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />Novo objetivo
        </Button>
      </div>

      {/* KPI strip */}
      {(poupancas.length > 0 || orcamentos.length > 0) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card><CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total poupado</p>
            <p className="text-xl font-bold text-emerald-500 mt-1">{formatCurrency(totalPoupado)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">de {formatCurrency(totalAlvo)}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Objetivos concluídos</p>
            <p className="text-xl font-bold mt-1">{concluidos}<span className="text-sm font-normal text-muted-foreground"> / {poupancas.length}</span></p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Orçamentos em dia</p>
            <p className="text-xl font-bold mt-1">{orcamentosOk}<span className="text-sm font-normal text-muted-foreground"> / {orcamentos.length}</span></p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Progresso geral</p>
            <p className="text-xl font-bold mt-1">{totalAlvo > 0 ? ((totalPoupado / totalAlvo) * 100).toFixed(0) : 0}%</p>
            <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${totalAlvo > 0 ? (totalPoupado / totalAlvo) * 100 : 0}%` }} />
            </div>
          </CardContent></Card>
        </div>
      )}

      {/* Savings section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <PiggyBank className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Poupanças</h2>
          <Badge variant="secondary" className="text-xs">{poupancas.length}</Badge>
        </div>

        {poupancas.length === 0 ? (
          <EmptyState icon={PiggyBank} title="Sem objetivos de poupança"
            description="Cria um objetivo para acompanhar as tuas poupanças."
            action={<Button onClick={() => { setEditing(null); setOpen(true); }}>Criar objetivo</Button>} />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {poupancas.map((obj) => (
                <PoupancaCard key={obj.id} obj={obj}
                  onEdit={() => { setEditing(obj); setOpen(true); }}
                  onContrib={() => setContribFor(obj)}
                  onDelete={() => setConfirmDelete(obj.id)} />
              ))}
            </div>

            {/* Bar chart comparison */}
            {poupancas.length > 1 && (
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Comparação de objetivos</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={barData} barSize={28}>
                      <XAxis dataKey="nome" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: any, name: string) => [formatCurrency(v), name === "poupado" ? "Poupado" : "Por poupar"]} />
                      <Bar dataKey="poupado" stackId="a" name="poupado" radius={[0, 0, 0, 0]}>
                        {barData.map((d, i) => <Cell key={i} fill={d.cor} />)}
                      </Bar>
                      <Bar dataKey="falta" stackId="a" name="falta" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Budgets section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Orçamentos</h2>
          <Badge variant="secondary" className="text-xs">{orcamentos.length}</Badge>
        </div>

        {orcamentos.length === 0 ? (
          <EmptyState icon={Target} title="Sem orçamentos"
            description="Define limites de gastos por categoria."
            action={<Button onClick={() => { setEditing(null); setOpen(true); }}>Criar orçamento</Button>} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {orcamentos.map((obj) => (
              <OrcamentoCard key={obj.id} obj={obj}
                onEdit={() => { setEditing(obj); setOpen(true); }}
                onDelete={() => setConfirmDelete(obj.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar objetivo" : "Novo objetivo"}</DialogTitle></DialogHeader>
          <GoalForm initial={editing} categorias={categorias}
            onSave={() => { setOpen(false); load(); }} onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!contribFor} onOpenChange={(o) => !o && setContribFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar poupança — {contribFor?.nome}</DialogTitle>
          </DialogHeader>
          {contribFor && (
            <ContribForm goal={contribFor}
              onSave={() => { setContribFor(null); load(); }}
              onClose={() => setContribFor(null)} />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Eliminar objetivo?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => confirmDelete && deleteObj(confirmDelete)}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
