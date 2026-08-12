export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";

function medianInterval(dates: Date[]): number {
  if (dates.length < 2) return 91 * 86400 * 1000; // default quarterly
  const intervals: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    intervals.push(dates[i].getTime() - dates[i - 1].getTime());
  }
  intervals.sort((a, b) => a - b);
  const mid = Math.floor(intervals.length / 2);
  return intervals.length % 2 === 0
    ? (intervals[mid - 1] + intervals[mid]) / 2
    : intervals[mid];
}

export async function GET() {
  const investimentos = await prisma.investment.findMany({ where: { ativa: true } });
  const dividendos = await prisma.investmentTransaction.findMany({
    where: { tipo: "DIVIDENDO" },
    include: { investment: true },
    orderBy: { data: "asc" },
  });

  const hoje = new Date();
  const mesInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const mesFim = new Date(hoje.getFullYear(), hoje.getMonth() + 12, 1);

  // Group by investmentId
  const byId: Record<string, { ticker: string; nome: string; datas: Date[]; valores: number[] }> = {};
  for (const d of dividendos) {
    const id = d.investmentId;
    if (!byId[id]) byId[id] = { ticker: d.investment.ticker, nome: d.investment.nome, datas: [], valores: [] };
    byId[id].datas.push(new Date(d.data));
    byId[id].valores.push(toNumber(d.valorDividendo));
  }

  // calendar[ticker][YYYY-MM] = total amount
  const calendar: Record<string, Record<string, number>> = {};
  const proximos: Array<{ ticker: string; nome: string; data: string; total: number; status: "estimado" }> = [];

  for (const [, data] of Object.entries(byId)) {
    const { ticker, nome, datas, valores } = data;
    if (datas.length === 0) continue;

    const intervaloMs = Math.max(25 * 86400 * 1000, Math.min(380 * 86400 * 1000, medianInterval(datas)));
    const avgValor = valores.slice(-4).reduce((s, v) => s + v, 0) / Math.min(4, valores.length);
    const lastDate = datas[datas.length - 1];

    let next = new Date(lastDate.getTime() + intervaloMs);
    // Cap at 15 iterations to avoid infinite loop
    let iter = 0;
    while (next < mesFim && iter < 15) {
      iter++;
      if (next >= mesInicio) {
        const mesKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
        if (!calendar[ticker]) calendar[ticker] = {};
        calendar[ticker][mesKey] = (calendar[ticker][mesKey] ?? 0) + avgValor;
        proximos.push({ ticker, nome, data: next.toISOString(), total: Math.round(avgValor * 100) / 100, status: "estimado" });
      }
      next = new Date(next.getTime() + intervaloMs);
    }
  }

  proximos.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

  // Yield data per investment
  const ha12Meses = new Date(hoje.getTime() - 365 * 86400 * 1000);

  const yieldData = investimentos
    .filter((inv) => toNumber(inv.quantidade) > 0)
    .map((inv) => {
      const divGroup = Object.values(byId).find((g) => g.ticker === inv.ticker);
      const portfolioValue = toNumber(inv.quantidade) * toNumber(inv.valorAtualUnidade);
      const costBasis = toNumber(inv.quantidade) * toNumber(inv.precoMedioCompra);

      // Annual income from last 12m history
      let annualIncome = dividendos
        .filter((d) => d.investmentId === inv.id && new Date(d.data) >= ha12Meses)
        .reduce((s, d) => s + toNumber(d.valorDividendo), 0);

      // If no recent dividends, project from pattern
      if (annualIncome === 0 && divGroup) {
        const avgV = divGroup.valores.slice(-4).reduce((s, v) => s + v, 0) / Math.min(4, divGroup.valores.length);
        const intervalMs = medianInterval(divGroup.datas);
        const pagsPerYear = (365 * 86400 * 1000) / Math.max(1, intervalMs);
        annualIncome = avgV * pagsPerYear;
      }

      // If still 0 and manual yield set, derive from yield
      const manualYield = toNumber(inv.dividendYieldManual);
      if (annualIncome === 0 && manualYield > 0) {
        annualIncome = portfolioValue * manualYield / 100;
      }

      const dividendYield = portfolioValue > 0 ? (annualIncome / portfolioValue) * 100 : manualYield;
      const yieldOnCost = costBasis > 0 ? (annualIncome / costBasis) * 100 : 0;

      return {
        id: inv.id,
        ticker: inv.ticker,
        nome: inv.nome,
        dividendYield: Math.round(dividendYield * 100) / 100,
        dividendYieldManual: manualYield,
        yieldOnCost: Math.round(yieldOnCost * 100) / 100,
        annualIncome: Math.round(annualIncome * 100) / 100,
        portfolioValue: Math.round(portfolioValue * 100) / 100,
      };
    });

  return NextResponse.json({ data: { calendar, proximos, yieldData } });
}
