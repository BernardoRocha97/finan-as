import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// XTB ticker → Yahoo Finance symbol
function toYahoo(ticker: string): string {
  if (ticker.endsWith(".US")) return ticker.slice(0, -3);
  if (ticker.endsWith(".UK")) return ticker.slice(0, -3) + ".L";
  return ticker; // .DE already valid for Yahoo
}

async function fetchPrice(symbol: string): Promise<{ price: number | null; currency: string | null }> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { price: null, currency: null };
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    return { price: meta?.regularMarketPrice ?? meta?.previousClose ?? null, currency: meta?.currency ?? null };
  } catch {
    return { price: null, currency: null };
  }
}

async function fetchFxRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;
  const { price } = await fetchPrice(`${from}${to}=X`);
  return price ?? 1;
}

// GET — return live prices for all open-position instruments (no DB write)
export async function GET() {
  try {
    const openLots = await prisma.lot.findMany({
      where: { status: { in: ["OPEN", "PARTIALLY_CLOSED"] } },
      include: { instrument: { select: { id: true, ticker: true, displayTicker: true, currency: true } } },
    });

    const instrumentMap = new Map<string, { id: string; ticker: string; displayTicker: string; currency: string }>();
    for (const lot of openLots) {
      instrumentMap.set(lot.instrument.id, lot.instrument);
    }

    const usdEur = await fetchFxRate("USD", "EUR");
    const gbpEur = await fetchFxRate("GBP", "EUR");

    const prices: Record<string, { priceNative: number | null; priceEur: number | null; currency: string; yahoo: string }> = {};

    for (const instr of instrumentMap.values()) {
      const yahoo = toYahoo(instr.displayTicker);
      const { price, currency: cur } = await fetchPrice(yahoo);

      if (!price || price <= 0) {
        prices[instr.id] = { priceNative: null, priceEur: null, currency: instr.currency, yahoo };
        continue;
      }

      const c = (cur ?? instr.currency).toUpperCase();
      let priceEur = price;
      if (c === "USD") priceEur = price * usdEur;
      else if (c === "GBP") priceEur = price * gbpEur;
      else if (c === "GBP" || c === "GBp") priceEur = (price / 100) * gbpEur;

      prices[instr.id] = {
        priceNative: Math.round(price * 10000) / 10000,
        priceEur: Math.round(priceEur * 10000) / 10000,
        currency: c,
        yahoo,
      };
    }

    return NextResponse.json({
      data: {
        prices,
        fxRates: { usdEur: Math.round(usdEur * 6) / 6, gbpEur: Math.round(gbpEur * 6) / 6 },
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error("Portfolio prices error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
