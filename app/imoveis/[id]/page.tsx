"use client";
import { useEffect, useState } from "react";
import { use } from "react";
import { formatCurrency, formatDate, toNumber } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { ArrowLeft, Plus, RefreshCw, TrendingUp, Edit2 } from "lucide-react";
import Link from "next/link";

export default function ImovelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [imovel, setImovel] = useState<any>(null);
  const [openHipoteca, setOpenHipoteca] = useState(false);
  const [openPagamento, setOpenPagamento] = useState(false);
  const [openImovel, setOpenImovel] = useState(false);
  const [showValorPanel, setShowValorPanel] = useState(false);
  const [precoPorMt2Input, setPrecoPorMt2Input] = useState(0);
  const [guardandoValor, setGuardandoValor] = useState(false);

  const load = () => fetch(`/api/imoveis/${id}`).then((r) => r.json()).then((d) => setImovel(d.data));
  useEffect(() => { load(); }, [id]);

  const calcularEGuardar = async () => {
    if (!precoPorMt2Input || precoPorMt2Input <= 0) return;
    setGuardandoValor(true);
    const area = toNumber(imovel?.areaMt2);
    const novoValor = area > 0 ? Math.round(area * precoPorMt2Input) : toNumber(imovel.valorEstimado);
    const dataCompra = imovel.dataCompra ? new Date(imovel.dataCompra).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    await fetch(`/api/imoveis/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: imovel.nome,
        morada: imovel.morada,
        valorEstimado: novoValor,
        valorCompra: toNumber(imovel.valorCompra),
        dataCompra,
        areaMt2: area || null,
        precoPorMt2: precoPorMt2Input,
        cor: imovel.cor,
        notas: imovel.notas,
      }),
    });
    await load();
    setGuardandoValor(false);
    setShowValorPanel(false);
  };

  if (!imovel) return <div className="p-6 text-muted-foreground">A carregar...</div>;

  const pagamentos = imovel.hipoteca?.pagamentos ?? [];
  const capitalProgress = imovel.hipoteca
    ? ((toNumber(imovel.hipoteca.valorInicial) - toNumber(imovel.hipoteca.capitalEmDivida)) / toNumber(imovel.hipoteca.valorInicial)) * 100
    : 0;
  const equity = toNumber(imovel.valorEstimado) - toNumber(imovel.hipoteca?.capitalEmDivida ?? 0);
  const valorizacao = toNumber(imovel.valorCompra) > 0
    ? ((toNumber(imovel.valorEstimado) - toNumber(imovel.valorCompra)) / toNumber(imovel.valorCompra)) * 100
    : 0;
  const area = toNumber(imovel.areaMt2);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/imoveis"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-2xl font-bold">{imovel.nome}</h1>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Valor estimado</p>
          <p className="text-xl font-bold mt-1">{formatCurrency(toNumber(imovel.valorEstimado))}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Equity</p>
          <p className={`text-xl font-bold mt-1 ${equity >= 0 ? "text-green-600" : "text-red-500"}`}>{formatCurrency(equity)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Valorização</p>
          <p className={`text-xl font-bold mt-1 ${valorizacao >= 0 ? "text-green-600" : "text-red-500"}`}>{valorizacao.toFixed(1)}%</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Capital em dívida</p>
          <p className="text-xl font-bold mt-1 text-red-500">{imovel.hipoteca ? formatCurrency(toNumber(imovel.hipoteca.capitalEmDivida)) : "—"}</p>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Informação geral */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Informação geral</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setOpenImovel(true)}>
                <Edit2 className="h-3.5 w-3.5 mr-1" />Editar
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setPrecoPorMt2Input(toNumber(imovel.precoPorMt2) || 3100); setShowValorPanel((v) => !v); }}>
                <TrendingUp className="h-3.5 w-3.5 mr-1" />Atualizar valor
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {imovel.morada && <div className="flex justify-between"><span className="text-muted-foreground">Morada</span><span>{imovel.morada}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">Valor de compra</span><span>{formatCurrency(toNumber(imovel.valorCompra))}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Data de compra</span><span>{formatDate(imovel.dataCompra)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Área</span><span>{area > 0 ? `${area} m²` : <span className="text-muted-foreground italic">não definida</span>}</span></div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Valor estimado</span>
              <span className="font-semibold">{formatCurrency(toNumber(imovel.valorEstimado))}</span>
            </div>
            {toNumber(imovel.precoPorMt2) > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Último preço/m² usado</span>
                <span>{formatCurrency(toNumber(imovel.precoPorMt2))}/m²</span>
              </div>
            )}

            {showValorPanel && (
              <div className="mt-3 p-3 rounded-lg border space-y-3">
                <p className="text-xs text-muted-foreground">
                  Consulta o preço atual em{" "}
                  <a href="https://www.idealista.pt/comprar-casas/queluz-de-baixo-sintra/" target="_blank" rel="noopener noreferrer" className="underline text-primary">Idealista</a>
                  {" "}ou{" "}
                  <a href="https://www.imovirtual.com/comprar/apartamento/queluz-de-baixo/" target="_blank" rel="noopener noreferrer" className="underline text-primary">Imovirtual</a>
                  {" "}e insere o €/m² para casas remodeladas.
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">Preço/m² (€)</Label>
                    <Input
                      type="number"
                      value={precoPorMt2Input || ""}
                      placeholder="ex: 3200"
                      onChange={(e) => setPrecoPorMt2Input(Number(e.target.value))}
                      className="mt-1 h-8 text-sm"
                    />
                  </div>
                  {area > 0 && precoPorMt2Input > 0 && (
                    <div className="flex-1 pt-5">
                      <p className="text-xs text-muted-foreground">Valor calculado</p>
                      <p className="font-semibold text-green-600">{formatCurrency(Math.round(area * precoPorMt2Input))}</p>
                      <p className="text-xs text-muted-foreground">{area} m² × {formatCurrency(precoPorMt2Input)}/m²</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setShowValorPanel(false)}>Cancelar</Button>
                  <Button size="sm" className="flex-1" disabled={!precoPorMt2Input || guardandoValor} onClick={calcularEGuardar}>
                    {guardandoValor ? <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
                    Guardar valor estimado
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hipoteca */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Hipoteca</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setOpenHipoteca(true)}>
              {imovel.hipoteca ? <><Edit2 className="h-3.5 w-3.5 mr-1" />Editar</> : <><Plus className="h-3.5 w-3.5 mr-1" />Adicionar</>}
            </Button>
          </CardHeader>
          <CardContent>
            {!imovel.hipoteca ? <p className="text-sm text-muted-foreground">Sem hipoteca associada.</p> : (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Banco</span><span>{imovel.hipoteca.banco}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Capital inicial</span><span>{formatCurrency(toNumber(imovel.hipoteca.valorInicial))}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Capital em dívida</span><span className="text-red-500 font-semibold">{formatCurrency(toNumber(imovel.hipoteca.capitalEmDivida))}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Taxa de juro</span><span>{toNumber(imovel.hipoteca.taxaJuro)}% ({imovel.hipoteca.tipoTaxa === "VARIAVEL_EURIBOR" ? "Variável Euribor" : "Fixa"})</span></div>
                {toNumber(imovel.hipoteca.spread) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Spread</span><span>{toNumber(imovel.hipoteca.spread)}%</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Prestação mensal</span><span className="font-semibold">{formatCurrency(toNumber(imovel.hipoteca.prestacaoMensal))}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Prazo</span><span>{imovel.hipoteca.prazoAnos} anos</span></div>
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">Capital amortizado</span><span>{capitalProgress.toFixed(0)}%</span></div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-green-500 transition-all" style={{ width: `${capitalProgress}%` }} /></div>
                </div>
                <Button size="sm" className="w-full mt-2" onClick={() => setOpenPagamento(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Registar prestação
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {pagamentos.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Histórico de prestações</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted"><tr><th className="text-left px-3 py-2">Data</th><th className="text-right px-3 py-2">Valor pago</th><th className="text-right px-3 py-2">Capital</th><th className="text-right px-3 py-2">Juros</th></tr></thead>
                <tbody className="divide-y">
                  {pagamentos.map((p: any) => (
                    <tr key={p.id} className="hover:bg-muted/50">
                      <td className="px-3 py-2 text-muted-foreground">{formatDate(p.data)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(toNumber(p.valorPago))}</td>
                      <td className="px-3 py-2 text-right text-green-600">{formatCurrency(toNumber(p.capitalAmortizado))}</td>
                      <td className="px-3 py-2 text-right text-red-500">{formatCurrency(toNumber(p.juros))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit imóvel dialog */}
      <Dialog open={openImovel} onOpenChange={setOpenImovel}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar imóvel</DialogTitle></DialogHeader>
          <ImovelForm initial={imovel} onSave={() => { setOpenImovel(false); load(); }} onClose={() => setOpenImovel(false)} />
        </DialogContent>
      </Dialog>

      {/* Hipoteca dialog */}
      <Dialog open={openHipoteca} onOpenChange={setOpenHipoteca}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{imovel.hipoteca ? "Editar hipoteca" : "Adicionar hipoteca"}</DialogTitle></DialogHeader>
          <HipotecaForm propertyId={id} initial={imovel.hipoteca} onSave={() => { setOpenHipoteca(false); load(); }} onClose={() => setOpenHipoteca(false)} />
        </DialogContent>
      </Dialog>

      {/* Pagamento dialog */}
      <Dialog open={openPagamento} onOpenChange={setOpenPagamento}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registar prestação</DialogTitle></DialogHeader>
          <PagamentoForm propertyId={id} hipoteca={imovel.hipoteca} onSave={() => { setOpenPagamento(false); load(); }} onClose={() => setOpenPagamento(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ImovelForm({ initial, onSave, onClose }: any) {
  const dataCompraInicial = initial?.dataCompra ? new Date(initial.dataCompra).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    nome: "", morada: "", valorEstimado: 0, valorCompra: 0, areaMt2: 0, cor: "#f59e0b", notas: "",
    ...initial,
    areaMt2: toNumber(initial?.areaMt2) || 0,
    valorEstimado: toNumber(initial?.valorEstimado) || 0,
    valorCompra: toNumber(initial?.valorCompra) || 0,
    dataCompra: dataCompraInicial,
  });
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    await fetch(`/api/imoveis/${initial.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: form.nome,
        morada: form.morada,
        valorEstimado: form.valorEstimado,
        valorCompra: form.valorCompra,
        dataCompra: form.dataCompra,
        areaMt2: form.areaMt2 || null,
        cor: form.cor,
        notas: form.notas,
      }),
    });
    setLoading(false);
    onSave();
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
        <div className="space-y-1"><Label>Área (m²)</Label><Input type="number" value={form.areaMt2 || ""} placeholder="ex: 95" onChange={(e) => setForm({ ...form, areaMt2: Number(e.target.value) })} /></div>
        <div className="space-y-1"><Label>Data de compra</Label><Input type="date" value={form.dataCompra} onChange={(e) => setForm({ ...form, dataCompra: e.target.value })} /></div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} disabled={loading || !form.nome}>{loading ? "A guardar..." : "Guardar"}</Button>
      </DialogFooter>
    </div>
  );
}

function HipotecaForm({ propertyId, initial, onSave, onClose }: any) {
  const dataInicioInicial = initial?.dataInicio ? new Date(initial.dataInicio).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    banco: "", valorInicial: 0, capitalEmDivida: 0, taxaJuro: 0,
    tipoTaxa: "FIXA", spread: 0, prestacaoMensal: 0, prazoAnos: 30,
    ...initial,
    valorInicial: toNumber(initial?.valorInicial) || 0,
    capitalEmDivida: toNumber(initial?.capitalEmDivida) || 0,
    taxaJuro: toNumber(initial?.taxaJuro) || 0,
    spread: toNumber(initial?.spread) || 0,
    prestacaoMensal: toNumber(initial?.prestacaoMensal) || 0,
    dataInicio: dataInicioInicial,
  });
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    await fetch(`/api/imoveis/${propertyId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, _action: "hipoteca" }),
    });
    setLoading(false);
    onSave();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1"><Label>Banco</Label><Input value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} /></div>
        <div className="space-y-1"><Label>Tipo de taxa</Label>
          <Select value={form.tipoTaxa} onValueChange={(v) => setForm({ ...form, tipoTaxa: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="FIXA">Fixa</SelectItem><SelectItem value="VARIAVEL_EURIBOR">Variável (Euribor)</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1"><Label>Capital inicial (€)</Label><MoneyInput value={form.valorInicial} onChange={(v) => setForm({ ...form, valorInicial: v })} /></div>
        <div className="space-y-1"><Label>Capital em dívida (€)</Label><MoneyInput value={form.capitalEmDivida} onChange={(v) => setForm({ ...form, capitalEmDivida: v })} /></div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1"><Label>Taxa juro (%)</Label><Input type="number" step="0.01" value={form.taxaJuro} onChange={(e) => setForm({ ...form, taxaJuro: Number(e.target.value) })} /></div>
        <div className="space-y-1"><Label>Spread (%)</Label><Input type="number" step="0.01" value={form.spread} onChange={(e) => setForm({ ...form, spread: Number(e.target.value) })} /></div>
        <div className="space-y-1"><Label>Prazo (anos)</Label><Input type="number" value={form.prazoAnos} onChange={(e) => setForm({ ...form, prazoAnos: Number(e.target.value) })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1"><Label>Prestação mensal (€)</Label><MoneyInput value={form.prestacaoMensal} onChange={(v) => setForm({ ...form, prestacaoMensal: v })} /></div>
        <div className="space-y-1"><Label>Data de início</Label><Input type="date" value={form.dataInicio} onChange={(e) => setForm({ ...form, dataInicio: e.target.value })} /></div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} disabled={loading || !form.banco}>{loading ? "A guardar..." : "Guardar"}</Button>
      </DialogFooter>
    </div>
  );
}

function PagamentoForm({ propertyId, hipoteca, onSave, onClose }: any) {
  const prestacao = toNumber(hipoteca?.prestacaoMensal) || 0;
  const taxaAnual = toNumber(hipoteca?.taxaJuro) || 0;
  const capital = toNumber(hipoteca?.capitalEmDivida) || 0;

  // Auto-calculate juros and capital from current balance
  const jurosMes = capital > 0 && taxaAnual > 0 ? Math.round((capital * (taxaAnual / 100 / 12)) * 100) / 100 : 0;
  const capitalAuto = prestacao > 0 ? Math.round((prestacao - jurosMes) * 100) / 100 : 0;

  const [form, setForm] = useState({
    data: new Date().toISOString().slice(0, 10),
    valorPago: prestacao,
    capitalAmortizado: capitalAuto,
    juros: jurosMes,
    notas: "",
  });
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    await fetch(`/api/imoveis/${propertyId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, _action: "pagamento" }),
    });
    setLoading(false);
    onSave();
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1"><Label>Data</Label><Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1"><Label>Valor pago (€)</Label><MoneyInput value={form.valorPago} onChange={(v) => setForm({ ...form, valorPago: v })} /></div>
        <div className="space-y-1"><Label>Capital amort. (€)</Label><MoneyInput value={form.capitalAmortizado} onChange={(v) => setForm({ ...form, capitalAmortizado: v })} /></div>
        <div className="space-y-1"><Label>Juros (€)</Label><MoneyInput value={form.juros} onChange={(v) => setForm({ ...form, juros: v })} /></div>
      </div>
      {jurosMes > 0 && (
        <p className="text-xs text-muted-foreground">
          Cálculo automático com base no capital em dívida ({formatCurrency(capital)}) e taxa {taxaAnual}%: {formatCurrency(jurosMes)} juros + {formatCurrency(capitalAuto)} capital.
        </p>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} disabled={loading}>{loading ? "A registar..." : "Registar"}</Button>
      </DialogFooter>
    </div>
  );
}
