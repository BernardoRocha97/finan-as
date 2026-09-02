"use client";
import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, toNumber } from "@/lib/utils";

// ─── helpers ────────────────────────────────────────────────────────────────

function fmt(v: number) { return formatCurrency(v); }
function fmtPct(v: number) { return v.toFixed(2) + "%"; }

function useNum(initial: number) {
  const [raw, setRaw] = useState(String(initial));
  const val = parseFloat(raw) || 0;
  return [val, raw, setRaw] as const;
}

// ─── Chart ──────────────────────────────────────────────────────────────────

function LineChart({ series, labels }: { series: { label: string; color: string; values: number[] }[]; labels: string[] }) {
  const allVals = series.flatMap((s) => s.values);
  const max = Math.max(...allVals, 1);
  const W = 700, H = 220, padL = 70, padB = 30, padT = 10, padR = 10;
  const iW = W - padL - padR;
  const iH = H - padB - padT;
  const n = labels.length;

  const x = (i: number) => padL + (i / (n - 1)) * iW;
  const y = (v: number) => padT + iH - (v / max) * iH;

  const ticks = 5;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 260 }}>
      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const yv = padT + (i / ticks) * iH;
        const val = max * (1 - i / ticks);
        return (
          <g key={i}>
            <line x1={padL} y1={yv} x2={W - padR} y2={yv} stroke="currentColor" strokeOpacity={0.1} />
            <text x={padL - 4} y={yv + 4} textAnchor="end" fontSize={9} fill="currentColor" fillOpacity={0.5}>
              {val >= 1000 ? (val / 1000).toFixed(0) + "k" : val.toFixed(0)}
            </text>
          </g>
        );
      })}
      {labels.filter((_, i) => i % Math.ceil(n / 8) === 0 || i === n - 1).map((l, _, arr) => {
        const origIdx = labels.indexOf(l);
        return (
          <text key={l} x={x(origIdx)} y={H - 6} textAnchor="middle" fontSize={9} fill="currentColor" fillOpacity={0.5}>
            {l}
          </text>
        );
      })}
      {series.map((s) => {
        const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
        const area = `M${x(0)},${y(0)} ` + s.values.map((v, i) => `L${x(i)},${y(v)}`).join(" ") + ` L${x(n - 1)},${padT + iH} L${x(0)},${padT + iH} Z`;
        return (
          <g key={s.label}>
            <path d={area} fill={s.color} fillOpacity={0.12} />
            <polyline points={pts} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
          </g>
        );
      })}
    </svg>
  );
}

function Legend({ series }: { series: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-4 text-xs">
      {series.map((s) => (
        <div key={s.label} className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: s.color }} />
          {s.label}
        </div>
      ))}
    </div>
  );
}

function SummaryRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex justify-between items-baseline py-1.5 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-right">
        <span className="font-semibold">{value}</span>
        {sub && <span className="text-xs text-muted-foreground ml-2">{sub}</span>}
      </div>
    </div>
  );
}

// ─── Tab: Poupança ───────────────────────────────────────────────────────────

function SimPoupanca({ initialSaldo }: { initialSaldo: number }) {
  const [capital, capitalRaw, setCapital] = useNum(initialSaldo);
  const [mensal, mensalRaw, setMensal] = useNum(200);
  const [taxa, taxaRaw, setTaxa] = useNum(2.5);
  const [anos, anosRaw, setAnos] = useNum(10);
  const retencao = 0.28;

  const { labels, semJuros, comJuros, comJurosLiq } = useMemo(() => {
    const n = Math.max(1, Math.round(anos));
    const labels = Array.from({ length: n + 1 }, (_, i) => i === 0 ? "Hoje" : `Ano ${i}`);
    const semJuros = [capital];
    const comJuros = [capital];
    const comJurosLiq = [capital];
    let sj = capital, cj = capital, cjl = capital;
    const taxaLiq = taxa * (1 - retencao) / 100;
    const taxaBruta = taxa / 100;
    for (let i = 0; i < n; i++) {
      sj += mensal * 12;
      cj = cj * (1 + taxaBruta) + mensal * 12;
      cjl = cjl * (1 + taxaLiq) + mensal * 12;
      semJuros.push(sj);
      comJuros.push(cj);
      comJurosLiq.push(cjl);
    }
    return { labels, semJuros, comJuros, comJurosLiq };
  }, [capital, mensal, taxa, anos]);

  const final = comJurosLiq[comJurosLiq.length - 1];
  const investido = capital + mensal * 12 * Math.round(anos);
  const jurosGanhos = final - investido;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Parâmetros</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1"><Label>Capital inicial (€)</Label><Input value={capitalRaw} onChange={(e) => setCapital(e.target.value)} type="number" /></div>
          <div className="space-y-1"><Label>Contribuição mensal (€)</Label><Input value={mensalRaw} onChange={(e) => setMensal(e.target.value)} type="number" /></div>
          <div className="space-y-1"><Label>Taxa de juro anual (%)</Label><Input value={taxaRaw} onChange={(e) => setTaxa(e.target.value)} type="number" step="0.1" /></div>
          <div className="space-y-1"><Label>Horizonte (anos)</Label><Input value={anosRaw} onChange={(e) => setAnos(e.target.value)} type="number" min="1" max="50" /></div>
          <div className="pt-2 text-xs text-muted-foreground">Retenção na fonte: 28%</div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-base">Evolução</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <LineChart
            labels={labels}
            series={[
              { label: "Sem juros", color: "#6b7280", values: semJuros },
              { label: "Com juros (bruto)", color: "#3b82f6", values: comJuros },
              { label: "Com juros (líquido)", color: "#10b981", values: comJurosLiq },
            ]}
          />
          <Legend series={[
            { label: "Sem juros", color: "#6b7280" },
            { label: "Com juros (bruto)", color: "#3b82f6" },
            { label: "Com juros (líquido)", color: "#10b981" },
          ]} />
          <div className="pt-2 space-y-0">
            <SummaryRow label="Total investido" value={fmt(investido)} />
            <SummaryRow label="Juros ganhos (líquido)" value={fmt(jurosGanhos)} sub={fmtPct(investido > 0 ? (jurosGanhos / investido) * 100 : 0)} />
            <SummaryRow label="Valor final (líquido)" value={fmt(final)} />
            <SummaryRow label="Rendimento mensal final" value={fmt(final * (taxa / 100) * (1 - retencao) / 12)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab: Investimento ────────────────────────────────────────────────────────

function SimInvestimento({ initialPortfolio, initialYield }: { initialPortfolio: number; initialYield: number }) {
  const [capital, capitalRaw, setCapital] = useNum(initialPortfolio);
  const [mensal, mensalRaw, setMensal] = useNum(300);
  const [crescimento, crescimentoRaw, setCrescimento] = useNum(7);
  const [yieldPct, yieldRaw, setYield] = useNum(initialYield > 0 ? initialYield : 5);
  const [anos, anosRaw, setAnos] = useNum(20);
  const retencao = 0.30;

  const { labels, capitalVals, dividendosAcum, totalVals } = useMemo(() => {
    const n = Math.max(1, Math.round(anos));
    const labels = Array.from({ length: n + 1 }, (_, i) => i === 0 ? "Hoje" : `Ano ${i}`);
    const capitalVals = [capital];
    const dividendosAcum = [0];
    const totalVals = [capital];
    let cap = capital;
    let divAcum = 0;
    for (let i = 0; i < n; i++) {
      const divAnual = cap * (yieldPct / 100) * (1 - retencao);
      divAcum += divAnual;
      cap = cap * (1 + crescimento / 100) + mensal * 12;
      capitalVals.push(cap);
      dividendosAcum.push(divAcum);
      totalVals.push(cap + divAcum);
    }
    return { labels, capitalVals, dividendosAcum, totalVals };
  }, [capital, mensal, crescimento, yieldPct, anos]);

  const finalCap = capitalVals[capitalVals.length - 1];
  const finalDiv = dividendosAcum[dividendosAcum.length - 1];
  const investido = capital + mensal * 12 * Math.round(anos);
  const divAnualFinal = finalCap * (yieldPct / 100) * (1 - retencao);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Parâmetros</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1"><Label>Portfólio atual (€)</Label><Input value={capitalRaw} onChange={(e) => setCapital(e.target.value)} type="number" /></div>
          <div className="space-y-1"><Label>Investimento mensal (€)</Label><Input value={mensalRaw} onChange={(e) => setMensal(e.target.value)} type="number" /></div>
          <div className="space-y-1"><Label>Crescimento anual esperado (%)</Label><Input value={crescimentoRaw} onChange={(e) => setCrescimento(e.target.value)} type="number" step="0.1" /></div>
          <div className="space-y-1"><Label>Dividend yield médio (%)</Label><Input value={yieldRaw} onChange={(e) => setYield(e.target.value)} type="number" step="0.1" /></div>
          <div className="space-y-1"><Label>Horizonte (anos)</Label><Input value={anosRaw} onChange={(e) => setAnos(e.target.value)} type="number" min="1" max="50" /></div>
          <div className="pt-2 text-xs text-muted-foreground">Retenção dividendos: 30%</div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-base">Evolução</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <LineChart
            labels={labels}
            series={[
              { label: "Capital", color: "#3b82f6", values: capitalVals },
              { label: "Dividendos acumulados (líq.)", color: "#10b981", values: dividendosAcum },
              { label: "Total", color: "#f59e0b", values: totalVals },
            ]}
          />
          <Legend series={[
            { label: "Capital", color: "#3b82f6" },
            { label: "Dividendos acumulados (líq.)", color: "#10b981" },
            { label: "Total", color: "#f59e0b" },
          ]} />
          <div className="pt-2 space-y-0">
            <SummaryRow label="Total investido" value={fmt(investido)} />
            <SummaryRow label="Valor do portfólio" value={fmt(finalCap)} />
            <SummaryRow label="Dividendos acumulados (líq.)" value={fmt(finalDiv)} />
            <SummaryRow label="Dividendo anual final (líq.)" value={fmt(divAnualFinal)} sub={`${fmt(divAnualFinal / 12)}/mês`} />
            <SummaryRow label="Ganho total" value={fmt(finalCap + finalDiv - investido)} sub={fmtPct(investido > 0 ? ((finalCap + finalDiv - investido) / investido) * 100 : 0)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab: FIRE ────────────────────────────────────────────────────────────────

function SimFIRE({ initialPortfolio, initialDespesas }: { initialPortfolio: number; initialDespesas: number }) {
  const [netWorth, netWorthRaw, setNetWorth] = useNum(initialPortfolio);
  const [despesas, despesasRaw, setDespesas] = useNum(initialDespesas);
  const [poupancaMensal, poupancaRaw, setPoupanca] = useNum(500);
  const [crescimento, crescimentoRaw, setCrescimento] = useNum(7);
  const [multiplicador, multRaw, setMultiplicador] = useNum(25);

  const fireNumber = despesas * 12 * multiplicador;
  const falta = Math.max(0, fireNumber - netWorth);

  const { anos, labels, vals } = useMemo(() => {
    const r = crescimento / 100;
    let val = netWorth;
    const vals = [val];
    const labels = ["Hoje"];
    let i = 0;
    while (val < fireNumber && i < 60) {
      val = val * (1 + r) + poupancaMensal * 12;
      i++;
      vals.push(val);
      labels.push(`Ano ${i}`);
    }
    return { anos: i, labels, vals };
  }, [netWorth, fireNumber, poupancaMensal, crescimento]);

  const dataFire = new Date();
  dataFire.setFullYear(dataFire.getFullYear() + anos);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Parâmetros</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1"><Label>Patrimônio líquido atual (€)</Label><Input value={netWorthRaw} onChange={(e) => setNetWorth(e.target.value)} type="number" /></div>
          <div className="space-y-1"><Label>Despesas mensais (€)</Label><Input value={despesasRaw} onChange={(e) => setDespesas(e.target.value)} type="number" /></div>
          <div className="space-y-1"><Label>Poupança/investimento mensal (€)</Label><Input value={poupancaRaw} onChange={(e) => setPoupanca(e.target.value)} type="number" /></div>
          <div className="space-y-1"><Label>Crescimento anual esperado (%)</Label><Input value={crescimentoRaw} onChange={(e) => setCrescimento(e.target.value)} type="number" step="0.1" /></div>
          <div className="space-y-1"><Label>Multiplicador FIRE</Label><Input value={multRaw} onChange={(e) => setMultiplicador(e.target.value)} type="number" /></div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-base">Caminho para FIRE</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {vals.length > 1 && (
            <>
              <LineChart
                labels={labels}
                series={[
                  { label: "Patrimônio", color: "#3b82f6", values: vals },
                  { label: "Nº FIRE", color: "#ef4444", values: Array(vals.length).fill(fireNumber) },
                ]}
              />
              <Legend series={[
                { label: "Patrimônio", color: "#3b82f6" },
                { label: "Número FIRE", color: "#ef4444" },
              ]} />
            </>
          )}
          <div className="pt-2 space-y-0">
            <SummaryRow label="Número FIRE" value={fmt(fireNumber)} sub={`${multiplicador}× despesas anuais`} />
            <SummaryRow label="Falta acumular" value={fmt(falta)} />
            {anos < 60
              ? <SummaryRow label="FIRE em" value={`${anos} anos`} sub={dataFire.getFullYear().toString()} />
              : <SummaryRow label="FIRE em" value="+60 anos" sub="Aumenta poupança ou reduz despesas" />
            }
            <SummaryRow label="Taxa de retirada segura" value={fmtPct(multiplicador > 0 ? 100 / multiplicador : 0)} />
            <SummaryRow label="Renda passiva mensal" value={fmt(fireNumber * (crescimento / 100) / 12)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SimuladorPage() {
  const [portfolioTotal, setPortfolioTotal] = useState(0);
  const [dividendYieldMedio, setDividendYieldMedio] = useState(0);
  const [saldoPoupanca, setSaldoPoupanca] = useState(0);
  const [despesasMensais, setDespesasMensais] = useState(0);
  const [netWorth, setNetWorth] = useState(0);

  useEffect(() => {
    fetch("/api/investimentos/resumo").then((r) => r.json()).then((d) => {
      const data = d.data ?? {};
      setPortfolioTotal(toNumber(data.valorTotal));
      const yield_ = data.valorTotal > 0 ? (data.dividendosAnuaisEsperados / data.valorTotal) * 100 : 0;
      setDividendYieldMedio(yield_);
    });
    fetch("/api/contas").then((r) => r.json()).then((d) => {
      const contas = d.data ?? [];
      const poupanca = contas.filter((c: any) => c.tipo === "POUPANCA").reduce((s: number, c: any) => s + toNumber(c.saldo), 0);
      setSaldoPoupanca(poupanca);
    });
    fetch("/api/relatorios/patrimonio").then((r) => r.json()).then((d) => {
      setNetWorth(toNumber(d.data?.netWorth ?? 0));
    });
    // despesas médias dos últimos 3 meses
    const tres = new Date(); tres.setMonth(tres.getMonth() - 3);
    fetch(`/api/transacoes?tipo=DESPESA&inicio=${tres.toISOString().slice(0, 10)}&limite=1000`)
      .then((r) => r.json()).then((d) => {
        const total = (d.data ?? []).reduce((s: number, t: any) => s + toNumber(t.valor), 0);
        setDespesasMensais(Math.round(total / 3));
      });
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Simulador</h1>
        <p className="text-sm text-muted-foreground mt-1">Valores pré-preenchidos com os teus dados reais. Ajusta à vontade.</p>
      </div>

      <Tabs defaultValue="poupanca">
        <TabsList>
          <TabsTrigger value="poupanca">Poupança</TabsTrigger>
          <TabsTrigger value="investimento">Investimento</TabsTrigger>
          <TabsTrigger value="fire">FIRE</TabsTrigger>
        </TabsList>

        <TabsContent value="poupanca" className="mt-6">
          <SimPoupanca initialSaldo={saldoPoupanca} />
        </TabsContent>

        <TabsContent value="investimento" className="mt-6">
          <SimInvestimento initialPortfolio={portfolioTotal} initialYield={dividendYieldMedio} />
        </TabsContent>

        <TabsContent value="fire" className="mt-6">
          <SimFIRE initialPortfolio={netWorth} initialDespesas={despesasMensais} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
