"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { toNumber } from "@/lib/utils";
import { Trash2, Download, Upload, Plus } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export default function ConfiguracoesPage() {
  const [prefs, setPrefs] = useState<any>({ metaTaxaPoupanca: 20, rendimentoAnualEsperado: 7, mostrarFireNumber: false, fireMultiplicador: 25, contribuicaoMensalDefault: 0 });
  const [categorias, setCategorias] = useState<any[]>([]);
  const [regras, setRegras] = useState<any[]>([]);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [newCat, setNewCat] = useState({ nome: "", cor: "#6b7280", tipo: "DESPESA" });
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/preferencias").then((r) => r.json()).then((d) => d.data && setPrefs(d.data));
    fetch("/api/categorias").then((r) => r.json()).then((d) => setCategorias(d.data ?? []));
    fetch("/api/regras").then((r) => r.json()).then((d) => setRegras(d.data ?? []));
  }, []);

  const savePrefs = async () => {
    setSavingPrefs(true);
    await fetch("/api/preferencias", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(prefs) });
    setSavingPrefs(false);
  };

  const addCat = async () => {
    if (!newCat.nome) return;
    await fetch("/api/categorias", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newCat) });
    fetch("/api/categorias").then((r) => r.json()).then((d) => setCategorias(d.data ?? []));
    setNewCat({ nome: "", cor: "#6b7280", tipo: "DESPESA" });
  };

  const delRegra = async (id: string) => {
    await fetch("/api/regras", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    fetch("/api/regras").then((r) => r.json()).then((d) => setRegras(d.data ?? []));
  };

  const backup = () => window.open("/api/backup", "_blank");

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Configurações</h1>

      <Tabs defaultValue="preferencias">
        <TabsList>
          <TabsTrigger value="preferencias">Preferências</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="regras">Regras</TabsTrigger>
          <TabsTrigger value="backup">Backup</TabsTrigger>
        </TabsList>

        <TabsContent value="preferencias">
          <Card>
            <CardHeader><CardTitle className="text-base">Preferências gerais</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Meta de taxa de poupança (%)</Label>
                  <Input type="number" value={prefs.metaTaxaPoupanca} onChange={(e) => setPrefs({ ...prefs, metaTaxaPoupanca: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label>Rendimento anual esperado (%)</Label>
                  <Input type="number" value={prefs.rendimentoAnualEsperado} onChange={(e) => setPrefs({ ...prefs, rendimentoAnualEsperado: Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Multiplicador FIRE</Label>
                  <Input type="number" value={prefs.fireMultiplicador} onChange={(e) => setPrefs({ ...prefs, fireMultiplicador: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label>Contribuição mensal padrão (€)</Label>
                  <MoneyInput value={prefs.contribuicaoMensalDefault} onChange={(v) => setPrefs({ ...prefs, contribuicaoMensalDefault: v })} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="fire" checked={prefs.mostrarFireNumber} onChange={(e) => setPrefs({ ...prefs, mostrarFireNumber: e.target.checked })} className="h-4 w-4" />
                <Label htmlFor="fire">Mostrar linha FIRE no gráfico de net worth</Label>
              </div>
              <Button onClick={savePrefs} disabled={savingPrefs}>{savingPrefs ? "A guardar..." : "Guardar"}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categorias">
          <Card>
            <CardHeader><CardTitle className="text-base">Categorias</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3 items-end">
                <div className="space-y-1 flex-1"><Label>Nome</Label><Input value={newCat.nome} onChange={(e) => setNewCat({ ...newCat, nome: e.target.value })} placeholder="Nova categoria..." /></div>
                <div className="space-y-1"><Label>Tipo</Label>
                  <Select value={newCat.tipo} onValueChange={(v) => setNewCat({ ...newCat, tipo: v ?? "DESPESA" })}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="DESPESA">Despesa</SelectItem><SelectItem value="RECEITA">Receita</SelectItem><SelectItem value="AMBOS">Ambos</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Cor</Label><input type="color" value={newCat.cor} onChange={(e) => setNewCat({ ...newCat, cor: e.target.value })} className="h-9 w-12 rounded border" /></div>
                <Button onClick={addCat} disabled={!newCat.nome}><Plus className="h-4 w-4" /></Button>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted"><tr><th className="text-left px-3 py-2">Nome</th><th className="text-left px-3 py-2">Tipo</th><th className="text-left px-3 py-2">Cor</th></tr></thead>
                  <tbody className="divide-y">
                    {categorias.map((c: any) => (
                      <tr key={c.id} className="hover:bg-muted/50">
                        <td className="px-3 py-2 font-medium">{c.nome}</td>
                        <td className="px-3 py-2 text-muted-foreground">{c.tipo}</td>
                        <td className="px-3 py-2"><span className="inline-block h-4 w-8 rounded" style={{ backgroundColor: c.cor }} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="regras">
          <Card>
            <CardHeader><CardTitle className="text-base">Regras de categorização automática</CardTitle></CardHeader>
            <CardContent>
              {regras.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem regras. As regras são criadas automaticamente quando editas a categoria de uma transação importada.</p>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted"><tr><th className="text-left px-3 py-2">Padrão</th><th className="text-left px-3 py-2">Categoria</th><th className="px-3 py-2" /></tr></thead>
                    <tbody className="divide-y">
                      {regras.map((r: any) => (
                        <tr key={r.id} className="hover:bg-muted/50">
                          <td className="px-3 py-2 font-mono text-xs">{r.padrao}</td>
                          <td className="px-3 py-2">{r.category?.nome}</td>
                          <td className="px-3 py-2 text-right">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => delRegra(r.id)}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backup">
          <Card>
            <CardHeader><CardTitle className="text-base">Backup e restauro</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-3">O backup descarrega o ficheiro <code className="text-xs bg-background px-1 py-0.5 rounded">finances.db</code> completo com todos os teus dados.</p>
                <Button onClick={backup} className="gap-2"><Download className="h-4 w-4" />Fazer backup agora</Button>
              </div>
              <div className="p-4 border border-red-200 dark:border-red-900 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-1">Restauro</p>
                <p className="text-xs text-muted-foreground mb-3">Restaurar um backup substitui TODOS os dados atuais. Esta ação não pode ser desfeita.</p>
                <p className="text-xs text-muted-foreground">Para restaurar, substitui manualmente o ficheiro <code>prisma/finances.db</code> pelo backup e reinicia a app.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
