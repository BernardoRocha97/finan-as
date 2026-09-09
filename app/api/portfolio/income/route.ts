import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now = new Date();
    const ttmStart = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    const allEvents = await prisma.incomeEvent.findMany({
      where: { status: "PAID" },
      include: { instrument: { select: { ticker: true, displayTicker: true, name: true, assetType: true } } },
      orderBy: { paymentDate: "desc" },
    });

    // By instrument
    const byInstrument: Record<string, {
      ticker: string; name: string; assetType: string;
      totalNet: number; totalGross: number; ttmNet: number; ttmGross: number; count: number;
      events: { date: Date | null; netEur: number; grossEur: number }[];
    }> = {};

    for (const e of allEvents) {
      const ticker = e.instrument?.displayTicker ?? "UNKNOWN";
      const name = e.instrument?.name ?? ticker;
      const assetType = e.instrument?.assetType ?? "OTHER";
      if (!byInstrument[ticker]) {
        byInstrument[ticker] = { ticker, name, assetType, totalNet: 0, totalGross: 0, ttmNet: 0, ttmGross: 0, count: 0, events: [] };
      }
      const net = Number(e.netEur ?? e.netAmount ?? 0);
      const gross = Number(e.grossEur ?? e.grossAmount ?? 0);
      byInstrument[ticker].totalNet += net;
      byInstrument[ticker].totalGross += gross;
      byInstrument[ticker].count++;
      byInstrument[ticker].events.push({ date: e.paymentDate, netEur: net, grossEur: gross });
      if (e.paymentDate && e.paymentDate >= ttmStart) {
        byInstrument[ticker].ttmNet += net;
        byInstrument[ticker].ttmGross += gross;
      }
    }

    const instruments = Object.values(byInstrument).sort((a, b) => b.totalNet - a.totalNet);

    // Monthly breakdown (last 24 months)
    const monthlyMap: Record<string, Record<string, number>> = {};
    for (const e of allEvents) {
      if (!e.paymentDate) continue;
      const key = `${e.paymentDate.getFullYear()}-${String(e.paymentDate.getMonth() + 1).padStart(2, "0")}`;
      const ticker = e.instrument?.displayTicker ?? "UNKNOWN";
      if (!monthlyMap[key]) monthlyMap[key] = {};
      monthlyMap[key][ticker] = (monthlyMap[key][ticker] ?? 0) + Number(e.netEur ?? e.netAmount ?? 0);
    }

    const monthly = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-24)
      .map(([month, tickers]) => ({
        month,
        total: Object.values(tickers).reduce((s, v) => s + v, 0),
        ...tickers,
      }));

    // Summary
    const totalNet = allEvents.reduce((s, e) => s + Number(e.netEur ?? e.netAmount ?? 0), 0);
    const totalGross = allEvents.reduce((s, e) => s + Number(e.grossEur ?? e.grossAmount ?? 0), 0);
    const ttmNet = allEvents
      .filter((e) => e.paymentDate && e.paymentDate >= ttmStart)
      .reduce((s, e) => s + Number(e.netEur ?? e.netAmount ?? 0), 0);
    const ttmGross = allEvents
      .filter((e) => e.paymentDate && e.paymentDate >= ttmStart)
      .reduce((s, e) => s + Number(e.grossEur ?? e.grossAmount ?? 0), 0);

    // Calendar: which months each ticker has paid (based on history)
    const calendarMap: Record<string, Set<number>> = {};
    for (const e of allEvents) {
      if (!e.paymentDate || !e.instrument) continue;
      const ticker = e.instrument.displayTicker;
      const month = e.paymentDate.getMonth();
      if (!calendarMap[ticker]) calendarMap[ticker] = new Set();
      calendarMap[ticker].add(month);
    }

    const calendar: Record<string, number[]> = {};
    for (const [ticker, months] of Object.entries(calendarMap)) {
      calendar[ticker] = Array.from(months).sort((a, b) => a - b);
    }

    return NextResponse.json({
      data: {
        summary: {
          totalNet: Math.round(totalNet * 100) / 100,
          totalGross: Math.round(totalGross * 100) / 100,
          ttmNet: Math.round(ttmNet * 100) / 100,
          ttmGross: Math.round(ttmGross * 100) / 100,
          monthlyAvgNet: Math.round((ttmNet / 12) * 100) / 100,
          eventCount: allEvents.length,
        },
        byInstrument: instruments.map((i) => ({
          ...i,
          totalNet: Math.round(i.totalNet * 100) / 100,
          totalGross: Math.round(i.totalGross * 100) / 100,
          ttmNet: Math.round(i.ttmNet * 100) / 100,
          ttmGross: Math.round(i.ttmGross * 100) / 100,
          events: undefined, // omit raw events from list
        })),
        monthly,
        calendar,
        events: allEvents.slice(0, 200).map((e) => ({
          id: e.id,
          ticker: e.instrument?.displayTicker ?? "—",
          name: e.instrument?.name ?? "—",
          date: e.paymentDate,
          eventType: e.eventType,
          grossEur: Math.round(Number(e.grossEur ?? e.grossAmount ?? 0) * 100) / 100,
          netEur: Math.round(Number(e.netEur ?? e.netAmount ?? 0) * 100) / 100,
          status: e.status,
        })),
      },
    });
  } catch (err: any) {
    console.error("Portfolio income error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
