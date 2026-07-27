export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";

export async function GET() {
  const operacoes = await prisma.investmentTransaction.findMany({
    where: { tipo: "DIVIDENDO" },
    include: { investment: true },
    orderBy: { data: "desc" },
  });

  return NextResponse.json({
    data: operacoes.map((o) => ({
      id: o.id,
      data: o.data,
      ticker: o.investment.ticker,
      nome: o.investment.nome,
      valorDividendo: toNumber(o.valorDividendo),
      notas: o.notas,
    })),
  });
}

