import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Latest snapshot (from XTB report)
    const snapshot = await prisma.portfolioSnapshot.findFirst({
      orderBy: { timestamp: "desc" },
    });

    // Live positions count
    const lotsCount = await prisma.lot.count({
      where: { status: { in: ["OPEN", "PARTIALLY_CLOSED"] } },
    });

    // Income TTM (last 12 months)
    const ttmStart = new Date();
    ttmStart.setFullYear(ttmStart.getFullYear() - 1);
    const incomeEvents = await prisma.incomeEvent.findMany({
      where: {
        status: "PAID",
        paymentDate: { gte: ttmStart },
      },
      select: { netEur: true, grossEur: true, taxEur: true },
    });

    const incomeTTMGross = incomeEvents.reduce((s, e) => s + Number(e.grossEur || 0), 0);
    const incomeTTMNet = incomeEvents.reduce((s, e) => s + Number(e.netEur || 0), 0);
    const incomeTTMTax = incomeEvents.reduce((s, e) => s + Number(e.taxEur || 0), 0);

    // All-time realized P/L from closed positions
    const closedLots = await prisma.lot.findMany({
      where: { status: "CLOSED" },
      select: { costEur: true },
    });

    // All-time dividends
    const allIncomeEvents = await prisma.incomeEvent.findMany({
      where: { status: "PAID" },
      select: { netEur: true, grossEur: true },
    });
    const allTimeDividendsGross = allIncomeEvents.reduce((s, e) => s + Number(e.grossEur || 0), 0);
    const allTimeDividendsNet = allIncomeEvents.reduce((s, e) => s + Number(e.netEur || 0), 0);

    return NextResponse.json({
      data: {
        snapshot: snapshot ? {
          timestamp: snapshot.timestamp,
          cash: Number(snapshot.cash),
          marketValue: Number(snapshot.marketValue),
          portfolioValue: Number(snapshot.portfolioValue),
          openPnl: Number(snapshot.openPnl || 0),
          source: snapshot.source,
        } : null,
        openPositions: lotsCount,
        income: {
          ttmGross: Math.round(incomeTTMGross * 100) / 100,
          ttmNet: Math.round(incomeTTMNet * 100) / 100,
          ttmTax: Math.round(incomeTTMTax * 100) / 100,
          allTimeGross: Math.round(allTimeDividendsGross * 100) / 100,
          allTimeNet: Math.round(allTimeDividendsNet * 100) / 100,
        },
      },
    });
  } catch (err: any) {
    console.error("Portfolio overview error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
