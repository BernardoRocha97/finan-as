"use client";
import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, toNumber } from "@/lib/utils";

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmt(v: number) { return formatCurrency(v); }
function fmtPct(v: number) { return (isFinite(v) ? v.toFixed(2) : "0.00") + "%"; }

function useNum(initial: number) {
  const [raw, setRaw] = useState(String(initial));
  const val = parseFloat(raw) || 0;
  return [val, raw, setRaw] as const;
}

function Field({ label, value, onChange, step = "0.1", min, note }: any) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} type="number" step={step} min={min} className="h-8 text-sm" />
      {note && <p className="text-[10px] text-muted-foreground">{note}</p>}
    </div>
  );
}

// ─── Chart ───────────────────────────────────────────────────────────────────

function AreaChart({ series, labels }: { series: { label: string; color: string; values: number[] }[]; labels: string[] }) {
  const allVals = series.flatMap((s) => s.values).filter(isFinite);
  const max = Math.max(...allVals, 1);
  const W = 700, H = 220, padL = 72, padB = 28, padT = 12, padR = 12;
  const iW = W - padL - padR, iH = H - padB - padT;
  const n = labels.length;
  const x = (i: number) => padL + (i / Math.max(n - 1, 1)) * iW;
  const y = (v: number) => padT + iH - (Math.max(0, v) / max) * iH;
  const step = Math.ceil(n / 9);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 240 }}>
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
        const yv = padT + t * iH; const val = max * (1 - t);
        return <g key={i}>
          <line x1={padL} y1={yv} x2={W - padR} y2={yv} stroke="currentColor" strokeOpacity={0.08} />
          <text x={padL - 4} y={yv + 4} textAnchor="end" fontSize={9} fill="currentColor" fillOpacity={0.45}>
            {val >= 1e6 ? (val / 1e6).toFixed(1) + "M" : val >= 1e3 ? (val / 1e3).toFixed(0) + "k" : val.toFixed(0)}
          </text>
        </g>;
      })}
      {labels.map((l, i) => i % step === 0 || i === n - 1
        ? <text key={i} x={x(i)} y={H - 4} textAnchor="middle" fontSize={9} fill="currentColor" fillOpacity={0.45}>{l}</text>
        : null
      )}
      {series.map((s) => {
        const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
        const area = `M${x(0)},${y(s.values[0])} ` + s.values.slice(1).map((v, i) => `L${x(i + 1)},${y(v)}`).join(" ") + ` L${x(n - 1)},${padT + iH} L${x(0)},${padT + iH} Z`;
        return <g key={s.label}>
          <path d={area} fill={s.color} fillOpacity={0.1} />
          <polyline points={pts} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
        </g>;
      })}
    </svg>
  );
}

function Legend({ series }: { series: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
      {series.map((s) => (
        <span key={s.label} className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-1.5 rounded-full" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

function Row({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-baseline py-1.5 border-b last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="text-right">
        <span className={`text-sm font-semibold ${highlight ? "text-green-600" : ""}`}>{value}</span>
        {sub && <span className="text-xs text-muted-foreground ml-2">{sub}</span>}
      </div>
    </div>
  );
}

function ScenarioBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{fmt(value)}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ─── Tab: Poupança ────────────────────────────────────────────────────────────

function SimPoupanca({ initialSaldo }: { initialSaldo: number }) {
  const [capital, capitalRaw, setCapital] = useNum(initialSaldo);
  const [mensal, mensalRaw, setMensal] = useNum(200);
  const [taxa, taxaRaw, setTaxa] = useNum(2.5);
  const [inflacao, inflacaoRaw, setInflacao] = useNum(2.5);
  const [anos, anosRaw, setAnos] = useNum(10);
  const [retencao, retencaoRaw, setRetencao] = useNum(28);

  const calc = useMemo(() => {
    const n = Math.max(1, Math.round(anos));
    const r = taxa / 100;
    const rLiq = r * (1 - retencao / 100);
    const rReal = rLiq - inflacao / 100;
    const labels = ["Hoje", ...Array.from({ length: n }, (_, i) => `Ano ${i + 1}`)];

    const nominal: number[] = [capital];
    const real: number[] = [capital];
    const semJuros: number[] = [capital];
    let nom = capital, re = capital, sj = capital;

    for (let i = 0; i < n; i++) {
      sj += mensal * 12;
      nom = nom * (1 + rLiq) + mensal * 12;
      re = re * (1 + rReal) + mensal * 12 / (1 + inflacao / 100);
      semJuros.push(sj);
      nominal.push(nom);
      real.push(re);
    }

    const investido = capital + mensal * 12 * n;
    const juros = nom - investido;
    const jurosAnuais = nom * rLiq;

    // cenários com taxas diferentes
    const cenarios = [taxa * 0.6, taxa, taxa * 1.4].map((t) => {
      let v = capital;
      const tl = t / 100 * (1 - retencao / 100);
      for (let i = 0; i < n; i++) v = v * (1 + tl) + mensal * 12;
      return v;
    });

    return { labels, nominal, real, semJuros, investido, juros, jurosAnuais, nom, re, cenarios };
  }, [capital, mensal, taxa, inflacao, anos, retencao]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Parâmetros */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Parâmetros</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Capital inicial (€)" value={capitalRaw} onChange={setCapital} step="100" />
            <Field label="Contribuição mensal (€)" value={mensalRaw} onChange={setMensal} step="50" />
            <Field label="Taxa de juro anual (%)" value={taxaRaw} onChange={setTaxa} step="0.1" />
            <Field label="Inflação anual (%)" value={inflacaoRaw} onChange={setInflacao} step="0.1" note="Afeta o poder de compra real" />
            <Field label="Retenção na fonte (%)" value={retencaoRaw} onChange={setRetencao} step="1" note="Portugal: 28%" />
            <Field label="Horizonte (anos)" value={anosRaw} onChange={setAnos} step="1" min="1" />
          </CardContent>
        </Card>

        {/* Gráfico */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Evolução do capital</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <AreaChart labels={calc.labels} series={[
              { label: "Sem juros", color: "#6b7280", values: calc.semJuros },
              { label: "Nominal (líquido)", color: "#3b82f6", values: calc.nominal },
              { label: "Real (poder de compra)", color: "#10b981", values: calc.real },
            ]} />
            <Legend series={[
              { label: "Sem juros", color: "#6b7280" },
              { label: "Nominal (líquido)", color: "#3b82f6" },
              { label: "Real (poder de compra)", color: "#10b981" },
            ]} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Resumo */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Resultados</CardTitle></CardHeader>
          <CardContent className="space-y-0">
            <Row label="Total depositado" value={fmt(calc.investido)} />
            <Row label="Juros ganhos (líq.)" value={fmt(calc.juros)} sub={fmtPct(calc.investido > 0 ? (calc.juros / calc.investido) * 100 : 0)} />
            <Row label="Valor final nominal" value={fmt(calc.nom)} highlight />
            <Row label="Valor final real" value={fmt(calc.re)} sub="poder de compra hoje" />
            <Row label="Rendimento mensal (no final)" value={fmt(calc.jurosAnuais / 12)} />
            <Row label="Rendimento diário (no final)" value={fmt(calc.jurosAnuais / 365)} />
          </CardContent>
        </Card>

        {/* Cenários */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Cenários de taxa</CardTitle></CardHeader>
          <CardContent className="space-y-3 pt-1">
            <ScenarioBar label={`Pessimista (${fmtPct(taxa * 0.6)})`} value={calc.cenarios[0]} max={calc.cenarios[2]} color="#ef4444" />
            <ScenarioBar label={`Base (${fmtPct(taxa)})`} value={calc.cenarios[1]} max={calc.cenarios[2]} color="#3b82f6" />
            <ScenarioBar label={`Otimista (${fmtPct(taxa * 1.4)})`} value={calc.cenarios[2]} max={calc.cenarios[2]} color="#10b981" />
          </CardContent>
        </Card>

        {/* Milestones */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Marcos</CardTitle></CardHeader>
          <CardContent className="space-y-0">
            {[10000, 25000, 50000, 100000, 250000].map((meta) => {
              if (meta <= calc.capital) return null;
              const r = calc.taxa / 100 * (1 - calc.retencao / 100);
              // solve: capital*(1+r)^n + mensal*12*((1+r)^n-1)/r = meta
              // approximate numerically
              let v = calc.capital, yr = 0;
              while (v < meta && yr < 100) { v = v * (1 + (calc.taxa / 100 * (1 - retencao / 100))) + mensal * 12; yr++; }
              return <Row key={meta} label={fmt(meta)} value={yr < 100 ? `${yr} anos` : "—"} />;
            }).filter(Boolean)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Tab: Investimento ────────────────────────────────────────────────────────

function SimInvestimento({ initialPortfolio, initialYield }: { initialPortfolio: number; initialYield: number }) {
  const [capital, capitalRaw, setCapital] = useNum(initialPortfolio);
  const [mensal, mensalRaw, setMensal] = useNum(300);
  const [crescimento, crescimentoRaw, setCrescimento] = useNum(7);
  const [yieldPct, yieldRaw, setYield] = useNum(Math.round(initialYield * 100) / 100 || 5);
  const [inflacao, inflacaoRaw, setInflacao] = useNum(2.5);
  const [taxaPlataforma, plataformaRaw, setPlataforma] = useNum(0);
  const [retencaoDividendos, retDivRaw, setRetDiv] = useNum(30);
  const [retencaoMaisValias, retMVRaw, setRetMV] = useNum(28);
  const [reinvestir, setReinvestir] = useState(true);
  const [anos, anosRaw, setAnos] = useNum(20);

  const calc = useMemo(() => {
    const n = Math.max(1, Math.round(anos));
    const r = crescimento / 100 - taxaPlataforma / 100;
    const dy = yieldPct / 100;
    const retDiv = retencaoDividendos / 100;
    const retMV = retencaoMaisValias / 100;
    const inf = inflacao / 100;
    const labels = ["Hoje", ...Array.from({ length: n }, (_, i) => `Ano ${i + 1}`)];

    const capitalVals = [capital];
    const dividendosAcum = [0];
    const totalVals = [capital];
    const realVals = [capital];
    let cap = capital, divAcum = 0;

    for (let i = 0; i < n; i++) {
      const divAnualBruto = cap * dy;
      const divAnualLiq = divAnualBruto * (1 - retDiv);
      divAcum += divAnualLiq;
      cap = cap * (1 + r) + mensal * 12 + (reinvestir ? divAnualLiq : 0);
      capitalVals.push(cap);
      dividendosAcum.push(divAcum);
      totalVals.push(cap + (reinvestir ? 0 : divAcum));
      realVals.push((cap + divAcum) / Math.pow(1 + inf, i + 1));
    }

    const investido = capital + mensal * 12 * n;
    const maisValia = capitalVals[n] - investido;
    const maisValiaLiq = maisValia > 0 ? maisValia * (1 - retMV) : maisValia;
    const divAnualFinal = capitalVals[n] * dy * (1 - retDiv);
    const totalLiq = maisValiaLiq + investido + dividendosAcum[n];

    // cenários
    const cenarios = [crescimento * 0.6, crescimento, crescimento * 1.4].map((g) => {
      let v = capital;
      for (let i = 0; i < n; i++) {
        const d = v * dy * (1 - retDiv);
        v = v * (1 + g / 100 - taxaPlataforma / 100) + mensal * 12 + (reinvestir ? d : 0);
      }
      return v;
    });

    return { labels, capitalVals, dividendosAcum, totalVals, realVals, investido, maisValia, maisValiaLiq, divAnualFinal, totalLiq, cenarios };
  }, [capital, mensal, crescimento, yieldPct, inflacao, taxaPlataforma, retencaoDividendos, retencaoMaisValias, reinvestir, anos]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Parâmetros</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Portfólio atual (€)" value={capitalRaw} onChange={setCapital} step="100" />
            <Field label="Investimento mensal (€)" value={mensalRaw} onChange={setMensal} step="50" />
            <Field label="Crescimento anual (%)" value={crescimentoRaw} onChange={setCrescimento} step="0.5" note="Valorização do portfólio" />
            <Field label="Dividend yield médio (%)" value={yieldRaw} onChange={setYield} step="0.1" />
            <Field label="Taxa plataforma/ano (%)" value={plataformaRaw} onChange={setPlataforma} step="0.01" note="Ex: 0.15% XTB" />
            <Field label="Retenção dividendos (%)" value={retDivRaw} onChange={setRetDiv} step="1" note="Portugal: 30%" />
            <Field label="Retenção mais-valias (%)" value={retMVRaw} onChange={setRetMV} step="1" note="Portugal: 28%" />
            <Field label="Inflação (%)" value={inflacaoRaw} onChange={setInflacao} step="0.1" />
            <Field label="Horizonte (anos)" value={anosRaw} onChange={setAnos} step="1" min="1" />
            <div className="flex items-center gap-2 pt-1">
              <input type="checkbox" id="reinv" checked={reinvestir} onChange={(e) => setReinvestir(e.target.checked)} className="h-3.5 w-3.5" />
              <label htmlFor="reinv" className="text-xs">Reinvestir dividendos</label>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Evolução do portfólio</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <AreaChart labels={calc.labels} series={[
              { label: "Capital", color: "#3b82f6", values: calc.capitalVals },
              { label: "Dividendos acumulados (líq.)", color: "#10b981", values: calc.dividendosAcum },
              { label: "Total", color: "#f59e0b", values: calc.totalVals },
              { label: "Real (inflação)", color: "#8b5cf6", values: calc.realVals },
            ]} />
            <Legend series={[
              { label: "Capital", color: "#3b82f6" },
              { label: "Dividendos acum. (líq.)", color: "#10b981" },
              { label: "Total", color: "#f59e0b" },
              { label: "Real (inflação)", color: "#8b5cf6" },
            ]} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Resultados</CardTitle></CardHeader>
          <CardContent className="space-y-0">
            <Row label="Total investido" value={fmt(calc.investido)} />
            <Row label="Mais-valias brutas" value={fmt(calc.maisValia)} />
            <Row label="Mais-valias líq. (após imp.)" value={fmt(calc.maisValiaLiq)} />
            <Row label="Dividendos acumulados (líq.)" value={fmt(calc.dividendosAcum[calc.dividendosAcum.length - 1])} />
            <Row label="Total líquido estimado" value={fmt(calc.totalLiq)} highlight />
            <Row label="Dividendo anual final (líq.)" value={fmt(calc.divAnualFinal)} sub={`${fmt(calc.divAnualFinal / 12)}/mês`} />
            <Row label="Ganho total" value={fmtPct(calc.investido > 0 ? ((calc.totalLiq - calc.investido) / calc.investido) * 100 : 0)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Cenários de crescimento</CardTitle></CardHeader>
          <CardContent className="space-y-3 pt-1">
            <ScenarioBar label={`Pessimista (${fmtPct(crescimento * 0.6)}/ano)`} value={calc.cenarios[0]} max={calc.cenarios[2]} color="#ef4444" />
            <ScenarioBar label={`Base (${fmtPct(crescimento)}/ano)`} value={calc.cenarios[1]} max={calc.cenarios[2]} color="#3b82f6" />
            <ScenarioBar label={`Otimista (${fmtPct(crescimento * 1.4)}/ano)`} value={calc.cenarios[2]} max={calc.cenarios[2]} color="#10b981" />
            <div className="pt-2 text-xs text-muted-foreground border-t">
              Dividendo mensal no cenário base: <span className="font-medium text-foreground">{fmt(calc.divAnualFinal / 12)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Marcos do portfólio</CardTitle></CardHeader>
          <CardContent className="space-y-0">
            {[50000, 100000, 250000, 500000, 1000000].map((meta) => {
              if (meta <= capital) return null;
              let v = capital, yr = 0;
              const dy = yieldPct / 100, rd = retencaoDividendos / 100, r = crescimento / 100 - taxaPlataforma / 100;
              while (v < meta && yr < 100) {
                const d = v * dy * (1 - rd);
                v = v * (1 + r) + mensal * 12 + (reinvestir ? d : 0);
                yr++;
              }
              return <Row key={meta} label={fmt(meta)} value={yr < 100 ? `${yr} anos` : "—"} />;
            }).filter(Boolean)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Tab: FIRE ────────────────────────────────────────────────────────────────

function SimFIRE({ initialNetWorth, initialDespesas, initialPortfolio }: { initialNetWorth: number; initialDespesas: number; initialPortfolio: number }) {
  const [netWorth, netWorthRaw, setNetWorth] = useNum(initialNetWorth);
  const [despesas, despesasRaw, setDespesas] = useNum(initialDespesas);
  const [poupanca, poupancaRaw, setPoupanca] = useNum(500);
  const [crescimento, crescimentoRaw, setCrescimento] = useNum(7);
  const [crescimentoRetirada, crRetRaw, setCrRet] = useNum(4);
  const [multiplicador, multRaw, setMultiplicador] = useNum(25);
  const [inflacao, inflacaoRaw, setInflacao] = useNum(2.5);
  const [pensao, pensaoRaw, setPensao] = useNum(0);
  const [despesasRetiro, despRetRaw, setDespRet] = useNum(initialDespesas);

  const calc = useMemo(() => {
    const fireNum = despesasRetiro * 12 * multiplicador;
    const leanFire = despesasRetiro * 0.7 * 12 * multiplicador;
    const fatFire = despesasRetiro * 1.5 * 12 * multiplicador;
    const inf = inflacao / 100;
    const r = crescimento / 100;
    const rRet = crescimentoRetirada / 100;

    // crescimento até FIRE
    const acumLabels = ["Hoje"];
    const acumVals = [netWorth];
    const acumReal = [netWorth];
    let val = netWorth, yr = 0;
    while (val < fireNum && yr < 60) {
      val = val * (1 + r) + poupanca * 12;
      yr++;
      acumLabels.push(`Ano ${yr}`);
      acumVals.push(val);
      acumReal.push(val / Math.pow(1 + inf, yr));
    }
    const anosParaFire = yr;
    const dataFire = new Date().getFullYear() + anosParaFire;
    const falta = Math.max(0, fireNum - netWorth);
    const valorNoFire = acumVals[acumVals.length - 1];

    // simulação de retirada após FIRE (30 anos)
    const retLabels = Array.from({ length: 31 }, (_, i) => i === 0 ? "FIRE" : `+${i}a`);
    const retNominal: number[] = [valorNoFire];
    const retReal: number[] = [valorNoFire];
    let retVal = valorNoFire;
    let extinguiu = false;
    for (let i = 0; i < 30; i++) {
      const despAnual = (despesasRetiro * 12 - pensao * 12) * Math.pow(1 + inf, i);
      retVal = retVal * (1 + rRet) - despAnual;
      retNominal.push(Math.max(0, retVal));
      retReal.push(Math.max(0, retVal / Math.pow(1 + inf, i + 1)));
      if (retVal <= 0 && !extinguiu) extinguiu = true;
    }
    const duravel = !extinguiu;

    // taxa de retirada segura real
    const taxaRetirada = fireNum > 0 ? (100 / multiplicador) : 0;
    const rendaMensal = (valorNoFire * rRet - despesasRetiro * 12 * Math.pow(1 + inf, anosParaFire)) / 12;

    return { fireNum, leanFire, fatFire, falta, anosParaFire, dataFire, valorNoFire, acumLabels, acumVals, acumReal, retLabels, retNominal, retReal, duravel, taxaRetirada };
  }, [netWorth, despesas, despesasRetiro, poupanca, crescimento, crescimentoRetirada, multiplicador, inflacao, pensao]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Parâmetros</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Patrimônio líquido atual (€)" value={netWorthRaw} onChange={setNetWorth} step="1000" />
            <Field label="Despesas mensais atuais (€)" value={despesasRaw} onChange={setDespesas} step="50" note="Média 12 meses real" />
            <Field label="Despesas mensais na reforma (€)" value={despRetRaw} onChange={setDespRet} step="50" note="Pode ser diferente do atual" />
            <Field label="Pensão estimada/mês (€)" value={pensaoRaw} onChange={setPensao} step="50" note="Reduz retirada necessária" />
            <Field label="Poupança/investimento mensal (€)" value={poupancaRaw} onChange={setPoupanca} step="50" />
            <Field label="Crescimento anual (acum.) (%)" value={crescimentoRaw} onChange={setCrescimento} step="0.5" />
            <Field label="Retorno na retirada (%)" value={crRetRaw} onChange={setCrRet} step="0.5" note="Geralmente mais conservador" />
            <Field label="Inflação (%)" value={inflacaoRaw} onChange={setInflacao} step="0.1" />
            <Field label="Multiplicador FIRE" value={multRaw} onChange={setMultiplicador} step="1" note="25 = regra dos 4%" />
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Acumulação até FIRE</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <AreaChart labels={calc.acumLabels} series={[
                { label: "Patrimônio nominal", color: "#3b82f6", values: calc.acumVals },
                { label: "Patrimônio real", color: "#10b981", values: calc.acumReal },
                { label: "Número FIRE", color: "#ef4444", values: Array(calc.acumLabels.length).fill(calc.fireNum) },
              ]} />
              <Legend series={[
                { label: "Patrimônio nominal", color: "#3b82f6" },
                { label: "Real (poder compra)", color: "#10b981" },
                { label: "Número FIRE", color: "#ef4444" },
              ]} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Sustentabilidade após FIRE (30 anos)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <AreaChart labels={calc.retLabels} series={[
                { label: "Patrimônio nominal", color: "#3b82f6", values: calc.retNominal },
                { label: "Patrimônio real", color: "#10b981", values: calc.retReal },
              ]} />
              <div className={`text-xs font-medium px-3 py-1.5 rounded ${calc.duravel ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>
                {calc.duravel ? "✓ Portfólio sustentável por 30+ anos com estes parâmetros" : "⚠ Portfólio esgota antes dos 30 anos — aumenta o multiplicador ou reduz despesas"}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Resultados FIRE</CardTitle></CardHeader>
          <CardContent className="space-y-0">
            <Row label="Número FIRE" value={fmt(calc.fireNum)} sub={`${multiplicador}× desp. anuais`} />
            <Row label="Falta acumular" value={fmt(calc.falta)} />
            {calc.anosParaFire < 60
              ? <Row label="Anos até FIRE" value={`${calc.anosParaFire} anos`} sub={String(calc.dataFire)} highlight />
              : <Row label="Anos até FIRE" value=">60 anos" sub="Revê parâmetros" />}
            <Row label="Taxa de retirada" value={fmtPct(calc.taxaRetirada)} />
            <Row label="Patrimônio no FIRE" value={fmt(calc.valorNoFire)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Variantes FIRE</CardTitle></CardHeader>
          <CardContent className="space-y-3 pt-1">
            <ScenarioBar label={`Lean FIRE (70% desp.)`} value={calc.leanFire} max={calc.fatFire} color="#f59e0b" />
            <ScenarioBar label={`Regular FIRE (100% desp.)`} value={calc.fireNum} max={calc.fatFire} color="#3b82f6" />
            <ScenarioBar label={`Fat FIRE (150% desp.)`} value={calc.fatFire} max={calc.fatFire} color="#10b981" />
            <div className="pt-2 text-xs text-muted-foreground border-t space-y-1">
              <div>Lean: <span className="font-medium text-foreground">{fmt(calc.leanFire)}</span></div>
              <div>Regular: <span className="font-medium text-foreground">{fmt(calc.fireNum)}</span></div>
              <div>Fat: <span className="font-medium text-foreground">{fmt(calc.fatFire)}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Impacto da poupança mensal</CardTitle></CardHeader>
          <CardContent className="space-y-0">
            {[poupanca * 0.5, poupanca, poupanca * 1.5, poupanca * 2].map((p) => {
              const r = crescimento / 100;
              let v = netWorth, yr = 0;
              while (v < calc.fireNum && yr < 60) { v = v * (1 + r) + p * 12; yr++; }
              return <Row key={p} label={`${fmt(p)}/mês`} value={yr < 60 ? `${yr} anos` : ">60 anos"} sub={yr < 60 ? String(new Date().getFullYear() + yr) : ""} />;
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SimuladorPage() {
  const [portfolioTotal, setPortfolioTotal] = useState(0);
  const [dividendYieldMedio, setDividendYieldMedio] = useState(0);
  const [saldoPoupanca, setSaldoPoupanca] = useState(0);
  const [despesasMensais, setDespesasMensais] = useState(0);
  const [saldoContas, setSaldoContas] = useState(0);

  useEffect(() => {
    // Carrega contas e investimentos em paralelo, soma no fim
    const fetchContas = fetch("/api/contas").then((r) => r.json()).then((d) => {
      const contas = d.data ?? [];
      setSaldoPoupanca(contas.filter((c: any) => c.tipo === "POUPANCA").reduce((s: number, c: any) => s + toNumber(c.saldo), 0));
      // soma saldos de contas não-investimento (corrente + poupança)
      return contas.filter((c: any) => c.tipo !== "INVESTIMENTO").reduce((s: number, c: any) => s + toNumber(c.saldo), 0);
    });

    const fetchInv = fetch("/api/investimentos/resumo").then((r) => r.json()).then((d) => {
      const data = d.data ?? {};
      const pt = toNumber(data.valorTotal);
      setPortfolioTotal(pt);
      const y = pt > 0 ? (data.dividendosAnuaisEsperados / pt) * 100 : 0;
      setDividendYieldMedio(Math.round(y * 100) / 100);
      return pt;
    });

    Promise.all([fetchContas, fetchInv]).then(([saldoBancario, portfolio]) => {
      // FIRE: saldo bancário (corrente + poupança) + portfólio de investimentos (sem imóvel)
      setSaldoContas(saldoBancario + portfolio);
    });

    // despesas médias dos últimos 12 meses
    const dozeM = new Date();
    dozeM.setMonth(dozeM.getMonth() - 12);
    fetch(`/api/transacoes?tipo=DESPESA&inicio=${dozeM.toISOString().slice(0, 10)}&limite=5000`)
      .then((r) => r.json()).then((d) => {
        const total = (d.data ?? []).reduce((s: number, t: any) => s + toNumber(t.valor), 0);
        setDespesasMensais(Math.round(total / 12));
      });
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Simulador</h1>
        <p className="text-sm text-muted-foreground mt-1">Pré-preenchido com os teus dados reais. Ajusta os parâmetros para explorar cenários.</p>
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
          <SimFIRE initialNetWorth={saldoContas} initialDespesas={despesasMensais} initialPortfolio={portfolioTotal} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
