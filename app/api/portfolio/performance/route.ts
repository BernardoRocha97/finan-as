import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toYahooSymbol, fetchYahooPrice, fetchFxRate, toEur } from "@/lib/portfolio/prices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Newton-Raphson XIRR
function xirr(cashFlows: { amount: number; date: Date }[], guess = 0.1): number | null {
  if (cashFlows.length < 2) return null;
  const t0 = cashFlows[0].date.getTime();
  const years = cashFlows.map((cf) => (cf.date.getTime() - t0) / (365.25 * 24 * 3600 * 1000));

  let rate = guess;
  for (let iter = 0; iter < 100; iter++) {
    let npv = 0;
    let dnpv = 0;
    for (let i = 0; i < cashFlows.length; i++) {
      const t = years[i];
      const cf = cashFlows[i].amount;
      const denom = Math.pow(1 + rate, t);
      npv += cf / denom;
      dnpv -= (t * cf) / (denom * (1 + rate));
    }
    if (Math.abs(dnpv) < 1e-10) break;
    const newRate = rate - npv / dnpv;
    if (Math.abs(newRate - rate) < 1e-7) return Math.round(newRate * 10000) / 100; // as %
    rate = newRate;
    if (rate < -0.999) rate = -0.999;
  }
  return null;
}

export async function GET() {
  try {
    // ── Fetch all relevant transactions ──────────────────────────────────────
    const txs = await prisma.portfolioTransaction.findMany({
      where: {
        broker: "XTB",
        transactionType: { in: ["BUY", "SELL", "DIVIDEND", "DISTRIBUTION", "WITHHOLDING_TAX"] },
      },
      include: { instrument: { select: { id: true, displayTicker: true, name: true } } },
      orderBy: { transactionDate: "asc" },
    });

    // ── Open lots for current market value ───────────────────────────────────
    const openLots = await prisma.lot.findMany({
      where: { status: { in: ["OPEN", "PARTIALLY_CLOSED"] } },
      include: { instrument: { select: { id: true, displayTicker: true, name: true, currency: true } } },
    });

    // Group open lot values and quantities per instrument
    const openValueByInstr: Record<string, { costEur: number; qty: number; ticker: string; name: string; currency: string; displayTicker: string }> = {};
    for (const lot of openLots) {
      const id = lot.instrumentId;
      if (!openValueByInstr[id]) openValueByInstr[id] = {
        costEur: 0, qty: 0,
        ticker: lot.instrument.displayTicker, name: lot.instrument.name,
        currency: lot.instrument.currency, displayTicker: lot.instrument.displayTicker,
      };
      openValueByInstr[id].costEur += Number(lot.costEur ?? 0);
      openValueByInstr[id].qty += Number(lot.remainingQuantity ?? 0);
    }

    // ── Income events for TTM Yield on Cost ──────────────────────────────────
    const ttmStart = new Date();
    ttmStart.setFullYear(ttmStart.getFullYear() - 1);
    const incomeEvents = await prisma.incomeEvent.findMany({
      where: { status: "PAID", paymentDate: { gte: ttmStart } },
      select: { instrumentId: true, netEur: true, grossEur: true },
    });

    const ttmIncomeByInstr: Record<string, number> = {};
    for (const ev of incomeEvents) {
      if (!ev.instrumentId) continue;
      ttmIncomeByInstr[ev.instrumentId] = (ttmIncomeByInstr[ev.instrumentId] ?? 0) + Number(ev.netEur ?? ev.grossEur ?? 0);
    }

    // ── Live market value for XIRR terminal value ────────────────────────────
    const usdEur = await fetchFxRate("USD", "EUR");
    const gbpEur = await fetchFxRate("GBP", "EUR");

    let liveInvestmentsValue = 0;
    for (const v of Object.values(openValueByInstr)) {
      if (v.qty <= 0) { liveInvestmentsValue += v.costEur; continue; }
      const yahoo = toYahooSymbol(v.displayTicker);
      const { price, currency: cur } = await fetchYahooPrice(yahoo);
      if (!price || price <= 0) { liveInvestmentsValue += v.costEur; continue; }
      const c = (cur ?? v.currency).toUpperCase();
      liveInvestmentsValue += v.qty * toEur(price, c, usdEur, gbpEur);
    }

    // ── Portfolio-level XIRR ──────────────────────────────────────────────────
    const portfolioCfs: { amount: number; date: Date }[] = [];

    // Cash flows: deposits/withdrawals from the XTB cash ledger
    const cashTxs = await prisma.portfolioTransaction.findMany({
      where: { broker: "XTB", externalId: { startsWith: "XTB-CASH-" } },
      select: { transactionType: true, amountEur: true, transactionDate: true },
      orderBy: { transactionDate: "asc" },
    });

    for (const tx of cashTxs) {
      const amount = Number(tx.amountEur ?? 0);
      if (Math.abs(amount) < 0.01) continue;
      if (tx.transactionType === "DEPOSIT") portfolioCfs.push({ amount: -Math.abs(amount), date: tx.transactionDate });
      else if (tx.transactionType === "WITHDRAWAL") portfolioCfs.push({ amount: Math.abs(amount), date: tx.transactionDate });
    }

    // Cash balance: sum all cash ledger entries
    const cashBal = cashTxs.reduce((s, t) => s + Number(t.amountEur ?? 0), 0);

    // Terminal value = live investments market value + cash balance
    const terminalValue = liveInvestmentsValue + cashBal;

    if (portfolioCfs.length > 0 && terminalValue > 0) {
      portfolioCfs.push({ amount: terminalValue, date: new Date() });
    }

    const portfolioXirr = portfolioCfs.length >= 2 ? xirr(portfolioCfs) : null;

    // ── Per-instrument metrics ────────────────────────────────────────────────
    const byInstr: Record<string, {
      ticker: string; name: string;
      totalBuyEur: number; totalSellEur: number; totalDividendEur: number;
      openCostEur: number; ttmIncomeEur: number;
      cfs: { amount: number; date: Date }[];
    }> = {};

    for (const tx of txs) {
      if (!tx.instrumentId || !tx.instrument) continue;
      const id = tx.instrumentId;
      if (!byInstr[id]) {
        byInstr[id] = {
          ticker: tx.instrument.displayTicker,
          name: tx.instrument.name,
          totalBuyEur: 0, totalSellEur: 0, totalDividendEur: 0,
          openCostEur: openValueByInstr[id]?.costEur ?? 0,
          ttmIncomeEur: ttmIncomeByInstr[id] ?? 0,
          cfs: [],
        };
      }
      const amount = Number(tx.amountEur ?? 0);
      if (tx.transactionType === "BUY") {
        byInstr[id].totalBuyEur += Math.abs(amount);
        byInstr[id].cfs.push({ amount: -Math.abs(amount), date: tx.transactionDate });
      } else if (tx.transactionType === "SELL") {
        byInstr[id].totalSellEur += Math.abs(amount);
        byInstr[id].cfs.push({ amount: Math.abs(amount), date: tx.transactionDate });
      } else if (tx.transactionType === "DIVIDEND" || tx.transactionType === "DISTRIBUTION") {
        byInstr[id].totalDividendEur += Math.abs(amount);
        byInstr[id].cfs.push({ amount: Math.abs(amount), date: tx.transactionDate });
      }
    }

    const instruments = Object.entries(byInstr).map(([id, d]) => {
      // Add terminal value for open positions
      const cfs = [...d.cfs];
      if (d.openCostEur > 0) cfs.push({ amount: d.openCostEur, date: new Date() });
      cfs.sort((a, b) => a.date.getTime() - b.date.getTime());

      const instrXirr = cfs.length >= 2 ? xirr(cfs) : null;
      const totalReturn = d.totalSellEur + d.totalDividendEur + d.openCostEur - d.totalBuyEur;
      const totalReturnPct = d.totalBuyEur > 0 ? (totalReturn / d.totalBuyEur) * 100 : 0;
      const yieldOnCost = d.openCostEur > 0 ? (d.ttmIncomeEur / d.openCostEur) * 100 : 0;
      const yieldOnCostAllTime = d.totalBuyEur > 0 ? (d.totalDividendEur / d.totalBuyEur) * 100 : 0;

      return {
        instrumentId: id,
        ticker: d.ticker,
        name: d.name,
        totalBuyEur: Math.round(d.totalBuyEur * 100) / 100,
        totalSellEur: Math.round(d.totalSellEur * 100) / 100,
        totalDividendEur: Math.round(d.totalDividendEur * 100) / 100,
        openCostEur: Math.round(d.openCostEur * 100) / 100,
        ttmIncomeEur: Math.round(d.ttmIncomeEur * 100) / 100,
        totalReturn: Math.round(totalReturn * 100) / 100,
        totalReturnPct: Math.round(totalReturnPct * 100) / 100,
        xirr: instrXirr,
        yieldOnCost: Math.round(yieldOnCost * 100) / 100,
        yieldOnCostAllTime: Math.round(yieldOnCostAllTime * 100) / 100,
      };
    }).sort((a, b) => b.totalBuyEur - a.totalBuyEur);

    // ── Portfolio summary metrics ─────────────────────────────────────────────
    const totalDeployed = instruments.reduce((s, i) => s + i.totalBuyEur, 0);
    const totalReturned = instruments.reduce((s, i) => s + i.totalSellEur + i.totalDividendEur, 0);
    const totalOpen = instruments.reduce((s, i) => s + i.openCostEur, 0);
    const totalDividends = instruments.reduce((s, i) => s + i.totalDividendEur, 0);
    const ttmIncome = instruments.reduce((s, i) => s + i.ttmIncomeEur, 0);
    const portfolioYoC = totalOpen > 0 ? (ttmIncome / totalOpen) * 100 : 0;

    return NextResponse.json({
      data: {
        portfolio: {
          xirr: portfolioXirr,
          totalDeployed: Math.round(totalDeployed * 100) / 100,
          totalReturned: Math.round(totalReturned * 100) / 100,
          totalOpenValue: Math.round(totalOpen * 100) / 100,
          liveInvestmentsValue: Math.round(liveInvestmentsValue * 100) / 100,
          cashBalance: Math.round(cashBal * 100) / 100,
          livePortfolioValue: Math.round((liveInvestmentsValue + cashBal) * 100) / 100,
          totalDividends: Math.round(totalDividends * 100) / 100,
          ttmIncome: Math.round(ttmIncome * 100) / 100,
          portfolioYieldOnCost: Math.round(portfolioYoC * 100) / 100,
        },
        instruments,
      },
    });
  } catch (err: any) {
    console.error("Portfolio performance error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
