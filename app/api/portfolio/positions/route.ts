import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Derives current positions from open lots (transactions-first architecture)
export async function GET() {
  try {
    // Get all open lots with their instrument
    const openLots = await prisma.lot.findMany({
      where: { status: { in: ["OPEN", "PARTIALLY_CLOSED"] } },
      include: { instrument: true },
      orderBy: { purchaseDate: "asc" },
    });

    // Group by instrument
    const positionMap = new Map<string, {
      instrument: { id: string; ticker: string; displayTicker: string; name: string; assetType: string; subtype: string | null; currency: string };
      lots: typeof openLots;
      totalQuantity: number;
      totalCostEur: number;
      totalCostNative: number;
    }>();

    for (const lot of openLots) {
      const key = lot.instrumentId;
      if (!positionMap.has(key)) {
        positionMap.set(key, {
          instrument: lot.instrument,
          lots: [],
          totalQuantity: 0,
          totalCostEur: 0,
          totalCostNative: 0,
        });
      }
      const pos = positionMap.get(key)!;
      pos.lots.push(lot);
      pos.totalQuantity += Number(lot.remainingQuantity);
      pos.totalCostEur += Number(lot.costEur || 0);
      pos.totalCostNative += Number(lot.totalCost) * Number(lot.remainingQuantity) / Number(lot.originalQuantity);
    }

    // Get current market values from latest snapshot or stored values
    // For now, use the values from the open position transactions (amountEur)
    const openTxMap = new Map<string, number>();
    const openTxs = await prisma.portfolioTransaction.findMany({
      where: {
        transactionType: "BUY",
        broker: "XTB",
        positionId: { not: null },
      },
      select: { positionId: true, amountEur: true, instrumentId: true },
    });
    for (const tx of openTxs) {
      if (!tx.instrumentId || !tx.amountEur) continue;
      const cur = openTxMap.get(tx.instrumentId) || 0;
      openTxMap.set(tx.instrumentId, cur + Number(tx.amountEur));
    }

    const positions = Array.from(positionMap.values()).map((pos) => {
      const totalQuantity = pos.totalQuantity;
      const openCostEur = pos.totalCostEur;
      const averageCostNative = totalQuantity > 0 ? pos.totalCostNative / totalQuantity : 0;

      // Market value from stored lot values (amountEur in open position BUY transactions)
      const marketValueEur = openTxMap.get(pos.instrument.id) || openCostEur;
      const unrealizedPnl = marketValueEur - openCostEur;
      const unrealizedPnlPct = openCostEur > 0 ? (unrealizedPnl / openCostEur) * 100 : 0;

      return {
        instrumentId: pos.instrument.id,
        ticker: pos.instrument.displayTicker,
        name: pos.instrument.name,
        assetType: pos.instrument.assetType,
        subtype: pos.instrument.subtype,
        currency: pos.instrument.currency,
        quantity: totalQuantity,
        averageCostNative: Math.round(averageCostNative * 10000) / 10000,
        openCostEur: Math.round(openCostEur * 100) / 100,
        marketValueEur: Math.round(marketValueEur * 100) / 100,
        unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
        unrealizedPnlPct: Math.round(unrealizedPnlPct * 100) / 100,
        lotsCount: pos.lots.length,
        lots: pos.lots.map((l) => ({
          id: l.id,
          purchaseDate: l.purchaseDate,
          originalQuantity: Number(l.originalQuantity),
          remainingQuantity: Number(l.remainingQuantity),
          unitCost: Number(l.unitCost),
          totalCost: Number(l.totalCost),
          costEur: Number(l.costEur || 0),
          status: l.status,
        })),
      };
    });

    // Sort by market value desc
    positions.sort((a, b) => b.marketValueEur - a.marketValueEur);

    const totalMarketValue = positions.reduce((s, p) => s + p.marketValueEur, 0);
    const totalOpenCost = positions.reduce((s, p) => s + p.openCostEur, 0);
    const totalUnrealizedPnl = positions.reduce((s, p) => s + p.unrealizedPnl, 0);

    // Add portfolio weight
    const positionsWithWeight = positions.map((p) => ({
      ...p,
      portfolioWeight: totalMarketValue > 0 ? Math.round((p.marketValueEur / totalMarketValue) * 10000) / 100 : 0,
    }));

    return NextResponse.json({
      data: {
        positions: positionsWithWeight,
        summary: {
          totalPositions: positions.length,
          totalMarketValue: Math.round(totalMarketValue * 100) / 100,
          totalOpenCost: Math.round(totalOpenCost * 100) / 100,
          totalUnrealizedPnl: Math.round(totalUnrealizedPnl * 100) / 100,
          totalUnrealizedPnlPct: totalOpenCost > 0 ? Math.round((totalUnrealizedPnl / totalOpenCost) * 10000) / 100 : 0,
        },
      },
    });
  } catch (err: any) {
    console.error("Portfolio positions error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
