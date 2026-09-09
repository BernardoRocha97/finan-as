import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const txs = await prisma.portfolioTransaction.findMany({
      where: { broker: "XTB" },
      include: { instrument: { select: { ticker: true, displayTicker: true, name: true } } },
      orderBy: { transactionDate: "desc" },
      take: 1000,
    });

    return NextResponse.json({
      data: txs.map((t) => ({
        id: t.id,
        transactionType: t.transactionType,
        transactionDate: t.transactionDate,
        instrument: t.instrument,
        quantity: t.quantity,
        price: t.price,
        amountEur: t.amountEur,
        netAmount: t.netAmount,
        fxRate: t.fxRate,
        externalId: t.externalId,
        positionId: t.positionId,
        comment: t.comment,
      })),
    });
  } catch (err: any) {
    console.error("Portfolio transactions error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
