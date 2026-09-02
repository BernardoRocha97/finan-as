"use client";
import { useEffect, useState } from "react";
import { formatCurrency, toNumber } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { Landmark, Plus, Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const TIPOS = [
  { value: "CORRENTE", label: "Conta Corrente" },
  { value: "POUPANCA", label: "Poupança" },
  { value: "INVESTIMENTO", label: "Investimento" },
  { value: "OUTROS", label: "Outros" },
];

function ContaForm({ initial, onSave, onClose }: any) {
  const [form, setForm] = useState({ nome: "", tipo: "CORRENTE", banco: "", saldo: 0, cor: "#3b82f6", iban: "", notas: "", taxaJuroPoupanca: "", ...initial });
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const save = async () => {
    setErro("");
    setLoading(true);
    const method = initial?.id ? "PUT" : "POST";
    const url = initial?.id ? `/api/contas/${initial.id}` : "/api/contas";
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, saldo: Number(form.saldo), taxaJuroPoupanca: form.taxaJuroPoupanca !== "" && form.taxaJuroPoupanca !== null ? Number(form.taxaJuroPoupanca) : null }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setErro(d?.error ? JSON.stringify(d.error) : "Erro ao guardar. Tenta novamente.");
      setLoading(false);
      return;
    }
    setLoading(false);
    onSave();
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Nome</Label>
        <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Tipo</Label>
          <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Banco</Label>
          <Input value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Saldo atual (€)</Label>
        <MoneyInput value={toNumber(form.saldo)} onChange={(v) => setForm({ ...form, saldo: v })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>IBAN (opcional)</Label>
          <Input value={form.iban ?? ""} onChange={(e) => setForm({ ...form, iban: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Cor</Label>
          <input type="color" value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} className="h-9 w-full rounded border cursor-pointer" />
        </div>
      </div>
      {form.tipo === "POUPANCA" && (
        <div className="space-y-1">
          <Label>Taxa de juro anual (%)</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="ex: 2.5"
            value={form.taxaJuroPoupanca ?? ""}
            onChange={(e) => setForm({ ...form, taxaJuroPoupanca: e.target.value })}
          />
        </div>
      )}
      {erro && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded px-3 py-2">{erro}</p>}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} disabled={loading || !form.nome || !form.banco}>
          {loading ? "A guardar..." : "Guardar"}
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function ContasPage() {
  const [contas, setContas] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [dividendosAnuais, setDividendosAnuais] = useState<number>(0);

  const load = () => {
    fetch("/api/contas").then((r) => r.json()).then((d) => setContas(d.data ?? []));
    fetch("/api/investimentos/resumo").then((r) => r.json()).then((d) => setDividendosAnuais(d.data?.dividendosAnuaisEsperados ?? 0));
  };

  useEffect(() => { load(); }, []);

  const del = async () => {
    if (!confirmId) return;
    await fetch(`/api/contas/${confirmId}`, { method: "DELETE" });
    setConfirmId(null);
    load();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Contas</h1>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />Nova conta
        </Button>
      </div>

      {contas.length === 0 ? (
        <EmptyState icon={Landmark} title="Sem contas" description="Cria a tua primeira conta bancária." action={<Button onClick={() => setOpen(true)}>Nova conta</Button>} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {contas.map((c: any) => (
            <Card key={c.id} className="relative">
              <div className="absolute top-0 left-0 h-full w-1 rounded-l-lg" style={{ backgroundColor: c.cor }} />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{c.nome}</CardTitle>
                    <p className="text-xs text-muted-foreground">{c.banco} · {TIPOS.find(t => t.value === c.tipo)?.label ?? c.tipo}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(c); setOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setConfirmId(c.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${toNumber(c.saldo) >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {formatCurrency(toNumber(c.saldo))}
                </p>
                {c.tipo === "INVESTIMENTO" && dividendosAnuais > 0 && (() => {
                  const anual = dividendosAnuais;
                  const mensal = anual / 12;
                  const diario = anual / 365;
                  const retencao = 0.28;
                  const anualLiq = anual * (1 - retencao);
                  const mensalLiq = anualLiq / 12;
                  const diarioLiq = anualLiq / 365;
                  return (
                    <div className="mt-2 pt-2 border-t border-dashed space-y-1.5">
                      <p className="text-xs text-muted-foreground font-medium">Dividendos esperados/ano</p>
                      <div className="grid grid-cols-3 gap-1 text-xs">
                        <div><span className="text-muted-foreground">Ano</span><br /><span className="font-semibold text-green-600">{formatCurrency(anual)}</span></div>
                        <div><span className="text-muted-foreground">Mês</span><br /><span className="font-semibold text-green-600">{formatCurrency(mensal)}</span></div>
                        <div><span className="text-muted-foreground">Dia</span><br /><span className="font-semibold text-green-600">{formatCurrency(diario)}</span></div>
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-xs pt-1 border-t border-dashed">
                        <div className="col-span-3 mb-0.5"><span className="text-muted-foreground">Líquido após 28% retenção</span></div>
                        <div><span className="font-semibold text-emerald-700 dark:text-emerald-400">{formatCurrency(anualLiq)}</span></div>
                        <div><span className="font-semibold text-emerald-700 dark:text-emerald-400">{formatCurrency(mensalLiq)}</span></div>
                        <div><span className="font-semibold text-emerald-700 dark:text-emerald-400">{formatCurrency(diarioLiq)}</span></div>
                      </div>
                    </div>
                  );
                })()}
                {c.taxaJuroPoupanca && toNumber(c.saldo) > 0 && (() => {
                  const taxa = toNumber(c.taxaJuroPoupanca) / 100;
                  const saldo = toNumber(c.saldo);
                  const anual = saldo * taxa;
                  const mensal = anual / 12;
                  const diario = anual / 365;
                  const retencao = 0.28;
                  const anualLiq = anual * (1 - retencao);
                  const mensalLiq = anualLiq / 12;
                  const diarioLiq = anualLiq / 365;
                  return (
                    <div className="mt-2 pt-2 border-t border-dashed space-y-1.5">
                      <p className="text-xs text-muted-foreground font-medium">Rendimento @ {toNumber(c.taxaJuroPoupanca)}%/ano</p>
                      <div className="grid grid-cols-3 gap-1 text-xs">
                        <div><span className="text-muted-foreground">Ano</span><br /><span className="font-semibold text-green-600">{formatCurrency(anual)}</span></div>
                        <div><span className="text-muted-foreground">Mês</span><br /><span className="font-semibold text-green-600">{formatCurrency(mensal)}</span></div>
                        <div><span className="text-muted-foreground">Dia</span><br /><span className="font-semibold text-green-600">{formatCurrency(diario)}</span></div>
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-xs pt-1 border-t border-dashed">
                        <div className="col-span-3 mb-0.5"><span className="text-muted-foreground">Líquido após 28% retenção</span></div>
                        <div><span className="font-semibold text-emerald-700 dark:text-emerald-400">{formatCurrency(anualLiq)}</span></div>
                        <div><span className="font-semibold text-emerald-700 dark:text-emerald-400">{formatCurrency(mensalLiq)}</span></div>
                        <div><span className="font-semibold text-emerald-700 dark:text-emerald-400">{formatCurrency(diarioLiq)}</span></div>
                      </div>
                    </div>
                  );
                })()}
                {c.iban && <p className="text-xs text-muted-foreground mt-1">{c.iban}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar conta" : "Nova conta"}</DialogTitle></DialogHeader>
          <ContaForm
            initial={editing}
            onSave={() => { setOpen(false); load(); }}
            onClose={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={(o) => !o && setConfirmId(null)}
        title="Eliminar conta?"
        description="Esta ação não pode ser desfeita."
        onConfirm={del}
      />
    </div>
  );
}
