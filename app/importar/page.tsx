"use client";
import { useEffect, useRef, useState } from "react";
import { formatCurrency, formatDate, toNumber, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { Upload, CheckCircle, AlertCircle, AlertTriangle, HelpCircle, RotateCcw } from "lucide-react";

const BANCOS = [
  { value: "santander", label: "Santander", hint: "santander" },
  { value: "cgd", label: "Caixa Geral de Depósitos", hint: "caixa" },
  { value: "bpi", label: "BPI", hint: "bpi" },
  { value: "millennium", label: "Millennium BCP", hint: "millennium" },
  { value: "generico", label: "CSV Genérico", hint: "" },
];

export default function ImportarPage() {
  const [contas, setContas] = useState<any[]>([]);
  const [banco, setBanco] = useState("santander");
  const [accountId, setAccountId] = useState("");
  const [preview, setPreview] = useState<any[]>([]);
  const [saldoExtrato, setSaldoExtrato] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  // Indices de duplicados/suspeitos que o utilizador quer incluir mesmo assim
  const [forceInclude, setForceInclude] = useState<Set<number>>(new Set());

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/contas").then((r) => r.json()).then((d) => {
      const list = d.data ?? [];
      setContas(list);
      autoSelectConta(list, "santander");
    });
    fetch("/api/importar").then((r) => r.json()).then((d) => setLogs(d.data ?? []));
  }, []);

  const autoSelectConta = (list: any[], bancoVal: string) => {
    const hint = BANCOS.find((b) => b.value === bancoVal)?.hint ?? "";
    if (hint) {
      const match = list.find((c: any) => c.nome.toLowerCase().includes(hint));
      if (match) { setAccountId(match.id); return; }
    }
    if (list.length) setAccountId(list[0].id);
  };

  const handleBanco = (v: string) => {
    setBanco(v);
    autoSelectConta(contas, v);
    if (file) { setPreview([]); setFile(null); setSaldoExtrato(null); setForceInclude(new Set()); }
  };

  const handleFile = async (f: File) => {
    setFile(f);
    setDone(null);
    setSaldoExtrato(null);
    setForceInclude(new Set());
    if (!accountId) return;
    setLoading(true);
    const fd = new FormData();
    fd.append("file", f);
    fd.append("banco", banco);
    fd.append("accountId", accountId);
    fd.append("action", "preview");
    const r = await fetch("/api/importar", { method: "POST", body: fd });
    const d = await r.json();
    setPreview(d.data ?? []);
    setSaldoExtrato(d.saldoExtrato ?? null);
    setLoading(false);
  };

  const toggleForce = (idx: number) => {
    setForceInclude((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const confirmar = async () => {
    if (!file || !accountId) return;
    setLoading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("banco", banco);
    fd.append("accountId", accountId);
    fd.append("action", "confirmar");
    fd.append("forceInclude", JSON.stringify([...forceInclude]));
    const r = await fetch("/api/importar", { method: "POST", body: fd });
    const d = await r.json();
    setDone(d.data);
    setPreview([]);
    setFile(null);
    setSaldoExtrato(null);
    setForceInclude(new Set());
    setLoading(false);
    fetch("/api/importar").then((r) => r.json()).then((d) => setLogs(d.data ?? []));
  };

  const contaSelecionada = contas.find((c) => c.id === accountId);
  const bancoDef = BANCOS.find((b) => b.value === banco);
  const nomeCombina = contaSelecionada && bancoDef?.hint
    ? contaSelecionada.nome.toLowerCase().includes(bancoDef.hint)
    : true;

  const novas = preview.filter((t) => t.status === "novo").length;
  const duplicadas = preview.filter((t) => t.status === "duplicado").length;
  const suspeitas = preview.filter((t) => t.status === "suspeito").length;
  // novas reais = novas + as que o user forçou incluir
  const totalAImportar = novas + [...forceInclude].filter((i) => preview[i]?.status !== "novo").length;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Importar extrato</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Configuração</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Banco do extrato</Label>
              <Select value={banco} onValueChange={handleBanco}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BANCOS.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Conta a atualizar</Label>
              <Select value={accountId} onValueChange={(v) => setAccountId(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Selecionar conta" /></SelectTrigger>
                <SelectContent>{contas.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {contaSelecionada && bancoDef?.hint && !nomeCombina && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-sm text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              Atenção: estás a importar um extrato do <strong>{bancoDef.label}</strong> para a conta <strong>{contaSelecionada.nome}</strong>. Confirma que é a conta certa.
            </div>
          )}

          {contaSelecionada && (
            <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-2">
              As transações serão importadas para <strong className="text-foreground">{contaSelecionada.nome}</strong>
              {saldoExtrato != null && <> e o saldo será atualizado para <strong className="text-foreground">{saldoExtrato.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</strong></>}.
            </div>
          )}

          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
            onClick={() => inputRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onDragOver={(e) => e.preventDefault()}
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {loading ? "A processar..." : file ? file.name : "Arrastar ficheiro XLS, XLSX ou CSV ou clica para selecionar"}
            </p>
            <input ref={inputRef} type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
        </CardContent>
      </Card>

      {done && (
        <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-green-800 dark:text-green-200 space-y-0.5">
            <p><strong>{done.importadas}</strong> transações importadas{done.duplicadas > 0 ? `, ${done.duplicadas} duplicadas ignoradas` : ""}{done.suspeitas > 0 ? `, ${done.suspeitas} suspeitas ignoradas` : ""}.</p>
            {done.saldoAtualizado != null && (
              <p>Saldo de <strong>{done.contaNome ?? contaSelecionada?.nome ?? "conta"}</strong> atualizado para <strong>{done.saldoAtualizado.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</strong>.</p>
            )}
          </div>
        </div>
      )}

      {preview.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-base flex flex-wrap gap-3">
                <span className="text-green-600">{novas} novas</span>
                {suspeitas > 0 && <span className="text-orange-500">{suspeitas} suspeitas</span>}
                {duplicadas > 0 && <span className="text-muted-foreground">{duplicadas} duplicadas</span>}
              </CardTitle>
              {saldoExtrato != null && (
                <p className="text-sm text-muted-foreground">
                  Saldo final do extrato: <strong className="text-foreground">{saldoExtrato.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</strong>
                </p>
              )}
              {suspeitas > 0 && (
                <p className="text-xs text-orange-600 dark:text-orange-400">
                  As transações suspeitas têm o mesmo valor e data de uma já existente mas descrição diferente. Decide se as queres incluir.
                </p>
              )}
            </div>
            <Button onClick={confirmar} disabled={loading || totalAImportar === 0} className="shrink-0">
              {loading ? "A importar..." : `Confirmar (${totalAImportar})`}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden max-h-[32rem] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 w-8">Estado</th>
                    <th className="text-left px-3 py-2">Data</th>
                    <th className="text-left px-3 py-2">Descrição</th>
                    <th className="text-left px-3 py-2">Categoria</th>
                    <th className="text-right px-3 py-2">Valor</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview.map((t: any, i: number) => {
                    const forced = forceInclude.has(i);
                    const isSuspeito = t.status === "suspeito";
                    const isDup = t.status === "duplicado";
                    const isNovo = t.status === "novo" || forced;

                    return (
                      <tr key={i} className={cn(
                        "hover:bg-muted/50",
                        isDup && !forced && "opacity-40 bg-muted/30",
                        isSuspeito && !forced && "bg-orange-50 dark:bg-orange-900/10",
                        forced && "bg-blue-50 dark:bg-blue-900/10",
                      )}>
                        <td className="px-3 py-2">
                          {isNovo && !forced && <CheckCircle className="h-4 w-4 text-green-600" />}
                          {forced && <CheckCircle className="h-4 w-4 text-blue-500" />}
                          {isDup && !forced && <AlertCircle className="h-4 w-4 text-muted-foreground" />}
                          {isSuspeito && !forced && <HelpCircle className="h-4 w-4 text-orange-500" />}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatDate(t.data)}</td>
                        <td className="px-3 py-2 max-w-xs">
                          <div className="truncate">{t.descricao}</div>
                          {(isSuspeito || isDup) && t.matchDesc && !forced && (
                            <div className="text-xs text-muted-foreground truncate mt-0.5">
                              Existente: {t.matchDesc}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">{t.categoryId && <CategoryBadge nome={t.categoryId} />}</td>
                        <td className={cn("px-3 py-2 text-right font-medium whitespace-nowrap", t.tipo === "RECEITA" ? "text-green-600" : "text-red-500")}>
                          {t.tipo === "RECEITA" ? "+" : "-"}{formatCurrency(t.valor)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {(isSuspeito || isDup) && (
                            <button
                              onClick={() => toggleForce(i)}
                              className={cn(
                                "text-xs px-2 py-1 rounded border transition-colors",
                                forced
                                  ? "border-blue-300 text-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100"
                                  : "border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary"
                              )}
                            >
                              {forced ? <span className="flex items-center gap-1"><RotateCcw className="h-3 w-3" />Desfazer</span> : "Incluir mesmo assim"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {logs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Histórico de importações</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-3 py-2">Ficheiro</th>
                    <th className="text-left px-3 py-2">Banco</th>
                    <th className="text-right px-3 py-2">Importadas</th>
                    <th className="text-right px-3 py-2">Ignoradas</th>
                    <th className="text-left px-3 py-2">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.map((l: any) => (
                    <tr key={l.id} className="hover:bg-muted/50">
                      <td className="px-3 py-2">{l.ficheiro}</td>
                      <td className="px-3 py-2 text-muted-foreground">{l.banco}</td>
                      <td className="px-3 py-2 text-right text-green-600">{l.importadas}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{l.duplicadas}</td>
                      <td className="px-3 py-2 text-muted-foreground">{formatDate(l.criadoEm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
