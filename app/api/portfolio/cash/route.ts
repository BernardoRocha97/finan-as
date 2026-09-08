import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Calculates cash balance from the transaction ledger
// cash = deposits + sales + dividends + interest - purchases - fees - taxes - withdrawals
export async function GET() {
  try {
    // Cash comes ONLY from Cash Operations (externalId starts with XTB-CASH-)
    // Open/Closed position BUY transactions are position entries, not cash flows
    const txs = await prisma.portfolioTransaction.findMany({
      where: { broker: "XTB", externalId: { startsWith: "XTB-CASH-" } },
      select: { transactionType: true, netAmount: true, amountEur: true },
    });

    const breakdown: Record<string, number> = {
      DEPOSIT: 0,
      WITHDRAWAL: 0,
      BUY: 0,
      SELL: 0,
      DIVIDEND: 0,
      DISTRIBUTION: 0,
      WITHHOLDING_TAX: 0,
      INTEREST: 0,
      INTEREST_TAX: 0,
      FEE: 0,
      OTHER: 0,
    };

    for (const tx of txs) {
      const amount = Number(tx.amountEur ?? tx.netAmount ?? 0);
      const type = tx.transactionType;
      if (type in breakdown) {
        breakdown[type] += amount;
      }
    }

    const cashBalance = Object.values(breakdown).reduce((s, v) => s + v, 0);

    return NextResponse.json({
      data: {
        cashBalance: Math.round(cashBalance * 100) / 100,
        breakdown: {
          deposits: Math.round(breakdown.DEPOSIT * 100) / 100,
          withdrawals: Math.round(breakdown.WITHDRAWAL * 100) / 100,
          purchases: Math.round(breakdown.BUY * 100) / 100,
          sales: Math.round(breakdown.SELL * 100) / 100,
          dividends: Math.round((breakdown.DIVIDEND + breakdown.DISTRIBUTION) * 100) / 100,
          withholdingTax: Math.round(breakdown.WITHHOLDING_TAX * 100) / 100,
          interest: Math.round(breakdown.INTEREST * 100) / 100,
          interestTax: Math.round(breakdown.INTEREST_TAX * 100) / 100,
          fees: Math.round(breakdown.FEE * 100) / 100,
        },
        goldenTest: {
          target: 1013.42,
          difference: Math.round((cashBalance - 1013.42) * 100) / 100,
          passes: Math.abs(cashBalance - 1013.42) < 0.05,
        },
      },
    });
  } catch (err: any) {
    console.error("Portfolio cash error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
