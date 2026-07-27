"use client";
import { useEffect, useState } from "react";
import { formatCurrency, formatDate, toNumber, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { Home, Plus, ChevronRight } from "lucide-react";
import Link from "next/link";

function ImovelForm({ initial, onSave, onClose }: any) {
  const dataCompraInicial = initial?.dataCompra ? new Date(initial.dataCompra).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ nome: "", morada: "", valorEstimado: 0, valorCompra: 0, cor: "#f59e0b", notas: "", ...initial, dataCompra: dataCompraInicial });
  const [loading, setLoading] = useState(false);
  const save = async () => {
    setLoading(true);
    const method = initial?.id ? "PUT" : "POST";
    const url = initial?.id ? `/api/imoveis/${initial.id}` : "/api/imoveis";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setLoading(false); onSave();
  };
  return (
    <div className="space-y-4">
      <div className="space-y-1"><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
      <div className="space-y-1"><Label>Morada</Label><Input value={form.morada ?? ""} onChange={(e) => setForm({ ...form, morada: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1"><Label>Valor compra (€)</Label><MoneyInput value={form.valorCompra} onChange={(v) => setForm({ ...form, valorCompra: v })} /></div>
        <div className="space-y-1"><Label>Valor estimado (€)</Label><MoneyInput value={form.valorEstimado} onChange={(v) => setForm({ ...form, valorEstimado: v })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1"><Label>Data de compra</Label><Input type="date" value={form.dataCompra} onChange={(e) => setForm({ ...form, dataCompra: e.target.value })} /></div>
        <div className="space-y-1"><Label>Cor</Label><input type="color" value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} className="h-9 w-full rounded border" /></div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} disabled={loading || !form.nome}>{loading ? "A guardar..." : "Guardar"}</Button>
      </DialogFooter>
    </div>
  );
}

export default function ImoveisPage() {
  const [imoveis, setImoveis] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  const load = () => fetch("/api/imoveis").then((r) => r.json()).then((d) => setImoveis(d.data ?? []));
  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Imóveis</h1>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Novo imóvel</Button>
      </div>

      {imoveis.length === 0 ? (
        <EmptyState icon={Home} title="Sem imóveis" description="Adiciona o teu primeiro imóvel." action={<Button onClick={() => setOpen(true)}>Novo imóvel</Button>} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {imoveis.map((p: any) => (
            <Card key={p.id} className="relative">
              <div className="absolute top-0 left-0 h-full w-1 rounded-l-lg" style={{ backgroundColor: p.cor }} />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{p.nome}</CardTitle>
                    {p.morada && <p className="text-xs text-muted-foreground">{p.morada}</p>}
                  </div>
                  <Link href={`/imoveis/${p.id}`}><Button variant="ghost" size="icon" className="h-7 w-7"><ChevronRight className="h-4 w-4" /></Button></Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valor estimado</span>
                  <span className="font-medium">{formatCurrency(toNumber(p.valorEstimado))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Equity</span>
                  <span className={cn("font-medium", p.equity >= 0 ? "text-green-600" : "text-red-500")}>{formatCurrency(p.equity)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valorização</span>
                  <span className={cn("font-medium", p.valorizacao >= 0 ? "text-green-600" : "text-red-500")}>{p.valorizacao.toFixed(1)}%</span>
                </div>
                {p.hipoteca && (
                  <div className="flex justify-between text-sm pt-1 border-t">
                    <span className="text-muted-foreground">Capital em dívida</span>
                    <span className="text-red-500 font-medium">{formatCurrency(toNumber(p.hipoteca.capitalEmDivida))}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo imóvel</DialogTitle></DialogHeader>
          <ImovelForm onSave={() => { setOpen(false); load(); }} onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
