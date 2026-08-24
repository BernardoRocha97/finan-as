"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { formatCurrency, formatDate, toNumber, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ArrowLeftRight, Plus, Pencil, Trash2, Check, Tag } from "lucide-react";

function TransacaoForm({ initial, contas, categorias, onSave, onClose }: any) {
  const dataInicial = initial?.data ? new Date(initial.data).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    descricao: "", valor: 0, tipo: "DESPESA", categoryId: "",
    accountId: contas[0]?.id ?? "", notas: "", revisada: true,
    ...initial, data: dataInicial,
  });
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    const method = initial?.id ? "PUT" : "POST";
    const url = initial?.id ? `/api/transacoes/${initial.id}` : "/api/transacoes";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, categoryId: form.categoryId || null }) });
    setLoading(false);
    onSave();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Data</Label>
          <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Tipo</Label>
          <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="DESPESA">Despesa</SelectItem>
              <SelectItem value="RECEITA">Receita</SelectItem>
              <SelectItem value="TRANSFERENCIA">Transferência</SelectItem>
              <SelectItem value="INVESTIMENTO">Investimento</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label>Descrição</Label>
        <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label>Valor (€)</Label>
        <MoneyInput value={form.valor} onChange={(v) => setForm({ ...form, valor: v })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Conta</Label>
          <Select value={form.accountId} onValueChange={(v) => setForm({ ...form, accountId: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{contas.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Categoria</Label>
          <Select value={form.categoryId ?? ""} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
            <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Sem categoria</SelectItem>
              {categorias.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label>Notas</Label>
        <Input value={form.notas ?? ""} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} disabled={loading || !form.descricao || !form.valor || !form.accountId}>
          {loading ? "A guardar..." : "Guardar"}
        </Button>
      </DialogFooter>
    </div>
  );
}

// Inline category picker that appears directly in the table row
function InlineCategoryPicker({ transacao, categorias, onSaved }: { transacao: any; categorias: any[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Detect if dropdown would be cut off at the bottom
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropUp(rect.bottom + 260 > window.innerHeight);
    }
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const pick = async (catId: string) => {
    setSaving(true);
    await fetch(`/api/transacoes/${transacao.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: catId, revisada: true }),
    });
    await fetch("/api/regras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ padrao: transacao.descricao, categoryId: catId }),
    });
    setSaving(false);
    setOpen(false);
    onSaved();
  };

  const marcarTransferencia = async () => {
    setSaving(true);
    await fetch(`/api/transacoes/${transacao.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "TRANSFERENCIA", revisada: true }),
    });
    setSaving(false);
    setOpen(false);
    onSaved();
  };

  const marcarInvestimento = async () => {
    setSaving(true);
    await fetch(`/api/transacoes/${transacao.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "INVESTIMENTO", revisada: true }),
    });
    setSaving(false);
    setOpen(false);
    onSaved();
  };

  const isInvestimento = transacao.tipo === "INVESTIMENTO";
  const isTransferencia = transacao.tipo === "TRANSFERENCIA";
  const hasCategory = transacao.category && transacao.category.id !== "Outros";

  return (
    <div className="relative" ref={ref}>
      {isInvestimento ? (
        <button
          ref={btnRef}
          onClick={() => setOpen(!open)}
          title="Clica para mudar"
          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded px-2 py-0.5 hover:opacity-70 transition-opacity"
        >
          📈 Investimento
        </button>
      ) : isTransferencia ? (
        <button
          ref={btnRef}
          onClick={() => setOpen(!open)}
          title="Clica para mudar"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted border border-muted-foreground/20 rounded px-2 py-0.5 hover:opacity-70 transition-opacity"
        >
          ↔ Transferência
        </button>
      ) : hasCategory ? (
        <button
          ref={btnRef}
          onClick={() => setOpen(!open)}
          title="Clica para mudar categoria"
          className="hover:opacity-70 transition-opacity"
        >
          <CategoryBadge nome={transacao.category.nome} cor={transacao.category.cor} />
        </button>
      ) : (
        <button
          ref={btnRef}
          onClick={() => setOpen(!open)}
          disabled={saving}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-dashed border-muted-foreground/40 rounded px-2 py-0.5 hover:border-primary transition-colors"
        >
          <Tag className="h-3 w-3" />
          {saving ? "..." : transacao.category?.nome === "Outros" ? "Outros" : "Categorizar"}
        </button>
      )}
      {open && (
        <div className={`absolute left-0 z-50 bg-popover border rounded-lg shadow-lg p-1 min-w-[200px] max-h-72 overflow-y-auto ${dropUp ? "bottom-full mb-1" : "top-full mt-1"}`}>
          {!isInvestimento && !isTransferencia && (
            <>
              <button
                onClick={marcarInvestimento}
                disabled={saving}
                className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2 text-blue-600 font-medium"
              >
                <span className="text-base">📈</span>
                Marcar como Investimento
              </button>
              <button
                onClick={marcarTransferencia}
                disabled={saving}
                className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-muted flex items-center gap-2 text-muted-foreground font-medium"
              >
                <span className="text-base">↔️</span>
                Marcar como Transferência
              </button>
              <div className="border-t my-1" />
            </>
          )}
          {isTransferencia && (
            <>
              <button
                onClick={async () => {
                  setSaving(true);
                  await fetch(`/api/transacoes/${transacao.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipo: "DESPESA", revisada: true }) });
                  setSaving(false); setOpen(false); onSaved();
                }}
                disabled={saving}
                className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-muted flex items-center gap-2 text-muted-foreground"
              >
                ↩ Reverter para Despesa
              </button>
              <div className="border-t my-1" />
            </>
          )}
          {isInvestimento && (
            <>
              <button
                onClick={async () => {
                  setSaving(true);
                  await fetch(`/api/transacoes/${transacao.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tipo: "DESPESA", revisada: true }),
                  });
                  setSaving(false);
                  setOpen(false);
                  onSaved();
                }}
                disabled={saving}
                className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-muted flex items-center gap-2 text-muted-foreground"
              >
                ↩ Reverter para Despesa
              </button>
              <div className="border-t my-1" />
            </>
          )}
          {categorias.map((c) => (
            <button
              key={c.id}
              onClick={() => pick(c.id)}
              className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-muted flex items-center gap-2 ${transacao.category?.id === c.id ? "bg-muted font-medium" : ""}`}
            >
              {c.cor && <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: c.cor }} />}
              {c.nome}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TransacoesPage() {
  const [transacoes, setTransacoes] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [contas, setContas] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "porCategorizar">("todos");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ pagina: String(pagina), limite: "50" });
    if (texto) params.set("texto", texto);
    if (tipo) params.set("tipo", tipo);
    if (filtro === "porCategorizar") params.set("naoRevisadas", "1");
    const r = await fetch(`/api/transacoes?${params}`);
    const d = await r.json();
    setTransacoes(d.data ?? []);
    setTotal(d.total ?? 0);
  }, [pagina, texto, tipo, filtro]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch("/api/contas").then((r) => r.json()).then((d) => setContas(d.data ?? []));
    fetch("/api/categorias").then((r) => r.json()).then((d) => setCategorias(d.data ?? []));
  }, []);

  const del = async () => {
    if (!confirmId) return;
    await fetch(`/api/transacoes/${confirmId}`, { method: "DELETE" });
    setConfirmId(null);
    load();
  };

  const marcarRevisada = async (id: string) => {
    await fetch(`/api/transacoes/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revisada: true }) });
    load();
  };

  const semCategoria = transacoes.filter((t) => !t.category || t.category.id === "Outros").length;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transações</h1>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />Nova transação
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <Input placeholder="Pesquisar..." value={texto} onChange={(e) => { setTexto(e.target.value); setPagina(1); }} className="max-w-xs" />
        <Select value={tipo || "TODOS"} onValueChange={(v) => { setTipo(v === "TODOS" ? "" : (v ?? "")); setPagina(1); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos</SelectItem>
            <SelectItem value="DESPESA">Despesa</SelectItem>
            <SelectItem value="RECEITA">Receita</SelectItem>
            <SelectItem value="TRANSFERENCIA">Transferência</SelectItem>
            <SelectItem value="INVESTIMENTO">Investimento</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-1 rounded-lg border p-1">
          <button
            onClick={() => { setFiltro("todos"); setPagina(1); }}
            className={cn("px-3 py-1 text-sm rounded-md transition-colors", filtro === "todos" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
          >
            Todas
          </button>
          <button
            onClick={() => { setFiltro("porCategorizar"); setPagina(1); }}
            className={cn("px-3 py-1 text-sm rounded-md transition-colors flex items-center gap-1.5", filtro === "porCategorizar" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
          >
            <Tag className="h-3 w-3" />
            Por categorizar
            {filtro === "todos" && semCategoria > 0 && (
              <span className="bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{semCategoria}</span>
            )}
          </button>
        </div>
      </div>

      {transacoes.length === 0 ? (
        <EmptyState icon={ArrowLeftRight} title="Sem transações" description={filtro === "porCategorizar" ? "Todas as transações já estão categorizadas." : "Cria ou importa transações."} />
      ) : (
        <>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Data</th>
                  <th className="text-left px-4 py-2 font-medium">Descrição</th>
                  <th className="text-left px-4 py-2 font-medium">Categoria</th>
                  <th className="text-left px-4 py-2 font-medium hidden lg:table-cell">Conta</th>
                  <th className="text-right px-4 py-2 font-medium">Valor</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {transacoes.map((t: any) => (
                  <tr key={t.id} className={cn("hover:bg-muted/50", !t.revisada && "bg-amber-50/60 dark:bg-amber-900/10")}>
                    <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{formatDate(t.data)}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        {!t.revisada && (
                          <button onClick={() => marcarRevisada(t.id)} title="Marcar como revisto" className="text-amber-500 hover:text-green-600 flex-shrink-0">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <span className="truncate max-w-xs">{t.descricao}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <InlineCategoryPicker transacao={t} categorias={categorias} onSaved={load} />
                    </td>
                    <td className="px-4 py-2 text-muted-foreground hidden lg:table-cell">{t.account?.nome}</td>
                    <td className={cn("px-4 py-2 text-right font-medium", t.tipo === "RECEITA" ? "text-green-600" : t.tipo === "DESPESA" ? "text-red-500" : t.tipo === "INVESTIMENTO" ? "text-blue-600" : "text-muted-foreground")}>
                      {t.tipo === "RECEITA" ? "+" : t.tipo === "DESPESA" ? "-" : t.tipo === "INVESTIMENTO" ? "📈" : ""}{formatCurrency(toNumber(t.valor))}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(t); setOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setConfirmId(t.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{total} transação(ões)</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={pagina * 50 >= total} onClick={() => setPagina(p => p + 1)}>Seguinte</Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar transação" : "Nova transação"}</DialogTitle></DialogHeader>
          <TransacaoForm initial={editing} contas={contas} categorias={categorias} onSave={() => { setOpen(false); load(); }} onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)} title="Eliminar transação?" onConfirm={del} />
    </div>
  );
}
