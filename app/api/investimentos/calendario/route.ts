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

// Group raw dividend rows into "payment events" by month (YYYY-MM).
// Multiple rows on the same month = one payment event with summed total.
function groupByMonth(datas: Date[], valores: number[]): { date: Date; total: number }[] {
  const byMonth: Record<string, { date: Date; total: number }> = {};
  for (let i = 0; i < datas.length; i++) {
    const key = `${datas[i].getFullYear()}-${String(datas[i].getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth[key]) byMonth[key] = { date: datas[i], total: 0 };
    byMonth[key].total += valores[i];
  }
  return Object.values(byMonth).sort((a, b) => a.date.getTime() - b.date.getTime());
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

  // Group raw rows by investmentId
  const rawById: Record<string, { ticker: string; nome: string; datas: Date[]; valores: number[] }> = {};
  for (const d of dividendos) {
    const id = d.investmentId;
    if (!rawById[id]) rawById[id] = { ticker: d.investment.ticker, nome: d.investment.nome, datas: [], valores: [] };
    rawById[id].datas.push(new Date(d.data));
    rawById[id].valores.push(toNumber(d.valorDividendo));
  }

  // Build per-investment grouped payment events (one entry per payment month)
  const byId: Record<string, { ticker: string; nome: string; events: { date: Date; total: number }[] }> = {};
  for (const [id, raw] of Object.entries(rawById)) {
    byId[id] = {
      ticker: raw.ticker,
      nome: raw.nome,
      events: groupByMonth(raw.datas, raw.valores),
    };
  }

  // calendar[ticker][YYYY-MM] = total amount
  const calendar: Record<string, Record<string, number>> = {};
  const proximos: Array<{ ticker: string; nome: string; data: string; total: number; status: "estimado" }> = [];

  for (const [, data] of Object.entries(byId)) {
    const { ticker, nome, events } = data;
    if (events.length === 0) continue;

    const eventDates = events.map((e) => e.date);
    const intervaloMs = Math.max(25 * 86400 * 1000, Math.min(380 * 86400 * 1000, medianInterval(eventDates)));

    // Average of last 4 payment events (each already summed per month)
    const lastEvents = events.slice(-4);
    const avgValor = lastEvents.reduce((s, e) => s + e.total, 0) / lastEvents.length;

    const lastDate = events[events.length - 1].date;

    let next = new Date(lastDate.getTime() + intervaloMs);
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

  // Yield data per investment — always use pattern-based projection (not raw 12m sum)
  // because: (1) XTB import may be partial, (2) multiple rows per payment event inflate the count

  const yieldData = investimentos
    .filter((inv) => toNumber(inv.quantidade) > 0)
    .map((inv) => {
      const group = Object.values(byId).find((g) => g.ticker === inv.ticker);
      const portfolioValue = toNumber(inv.quantidade) * toNumber(inv.valorAtualUnidade);
      const costBasis = toNumber(inv.quantidade) * toNumber(inv.precoMedioCompra);
      const manualYield = toNumber(inv.dividendYieldManual);

      let annualIncome: number;
      let dividendYield: number;

      if (manualYield > 0) {
        annualIncome = portfolioValue * manualYield / 100;
        dividendYield = manualYield;
      } else if (group && group.events.length > 0) {
        // Project annual income from payment pattern (robust against partial imports and multiple rows)
        const lastEvents = group.events.slice(-4);
        const avgPayment = lastEvents.reduce((s, e) => s + e.total, 0) / lastEvents.length;
        const eventDates = group.events.map((e) => e.date);
        const intervalMs = medianInterval(eventDates);
        const pagsPerYear = (365 * 86400 * 1000) / Math.max(1, intervalMs);
        annualIncome = avgPayment * pagsPerYear;
        dividendYield = portfolioValue > 0 ? (annualIncome / portfolioValue) * 100 : 0;
      } else {
        annualIncome = 0;
        dividendYield = 0;
      }

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
