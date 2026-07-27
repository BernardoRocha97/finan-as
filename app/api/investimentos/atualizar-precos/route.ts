import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// XTB ticker → { yahoo symbol, currency of that symbol }
function toYahoo(ticker: string): { symbol: string; currency: "USD" | "EUR" | "GBP" } {
  if (ticker.endsWith(".US")) return { symbol: ticker.slice(0, -3), currency: "USD" };
  if (ticker.endsWith(".UK")) return { symbol: ticker.slice(0, -3) + ".L", currency: "GBP" };
  return { symbol: ticker, currency: "EUR" }; // .DE → already EUR
}

async function fetchYahooData(symbol: string): Promise<{ price: number | null; currency: string | null }> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return { price: null, currency: null };
  const json = await res.json();
  const meta = json?.chart?.result?.[0]?.meta;
  return {
    price: meta?.regularMarketPrice ?? meta?.previousClose ?? null,
    currency: meta?.currency ?? null,
  };
}

async function fetchFxRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;
  const pair = `${from}${to}=X`;
  const { price } = await fetchYahooData(pair);
  return price ?? 1;
}

export async function POST() {
  const investimentos = await prisma.investment.findMany({ where: { ativa: true, quantidade: { gt: 0 } } });

  // Fetch FX rates once
  const usdEur = await fetchFxRate("USD", "EUR");
  const gbpEur = await fetchFxRate("GBP", "EUR");

  const resultados: {
    ticker: string; yahoo: string; precoOriginal: number | null;
    precoEur: number | null; moeda: string; erro?: string;
  }[] = [];

  for (const inv of investimentos) {
    const { symbol, currency: expectedCurrency } = toYahoo(inv.ticker);
    try {
      const { price, currency: actualCurrency } = await fetchYahooData(symbol);

      if (!price || price <= 0) {
        resultados.push({ ticker: inv.ticker, yahoo: symbol, precoOriginal: null, precoEur: null, moeda: expectedCurrency, erro: "Preço indisponível" });
        continue;
      }

      // Convert to EUR
      const cur = (actualCurrency ?? expectedCurrency).toUpperCase();
      let precoEur = price;
      if (cur === "USD") precoEur = price * usdEur;
      else if (cur === "GBP") precoEur = price * gbpEur;
      else if (cur === "GBp") precoEur = (price / 100) * gbpEur; // pence

      precoEur = Math.round(precoEur * 10000) / 10000;

      await prisma.investment.update({
        where: { id: inv.id },
        data: { valorAtualUnidade: precoEur },
      });

      resultados.push({ ticker: inv.ticker, yahoo: symbol, precoOriginal: price, precoEur, moeda: cur });
    } catch (e: any) {
      resultados.push({ ticker: inv.ticker, yahoo: symbol, precoOriginal: null, precoEur: null, moeda: expectedCurrency, erro: e.message?.slice(0, 60) });
    }
  }

  const atualizados = resultados.filter((r) => r.precoEur !== null).length;

  // Recalculate total portfolio value and update XTB account balance
  const todasPosicoes = await prisma.investment.findMany({ where: { ativa: true, quantidade: { gt: 0 } } });
  const totalCarteira = todasPosicoes.reduce((sum, inv) => {
    return sum + Number(inv.quantidade) * Number(inv.valorAtualUnidade);
  }, 0);

  // Update the account with banco = "XTB"
  const contaXtb = await prisma.account.findFirst({ where: { banco: "XTB", ativa: true } });
  if (contaXtb) {
    await prisma.account.update({
      where: { id: contaXtb.id },
      data: { saldo: totalCarteira },
    });
  }

  return NextResponse.json({
    data: {
      resultados,
      atualizados,
      total: investimentos.length,
      taxas: { usdEur: Math.round(usdEur * 10000) / 10000, gbpEur: Math.round(gbpEur * 10000) / 10000 },
      totalCarteira: Math.round(totalCarteira * 100) / 100,
      contaAtualizada: !!contaXtb,
    },
  });
}
