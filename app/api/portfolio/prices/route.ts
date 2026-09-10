import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toYahooSymbol, fetchYahooPrice, fetchFxRate, toEur } from "@/lib/portfolio/prices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
      const yahoo = toYahooSymbol(instr.displayTicker);
      const { price, currency: cur } = await fetchYahooPrice(yahoo);

      if (!price || price <= 0) {
        prices[instr.id] = { priceNative: null, priceEur: null, currency: instr.currency, yahoo };
        continue;
      }

      const c = (cur ?? instr.currency).toUpperCase();
      const priceEur = toEur(price, c, usdEur, gbpEur);

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
