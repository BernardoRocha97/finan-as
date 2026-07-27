export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server";
import { calcNetWorth } from "@/lib/networth";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";

export async function GET() {
  const { totalAtivos, totalPassivos, netWorth, breakdown } = await calcNetWorth();

  const [contas, investimentos, imoveis, hipotecas] = await Promise.all([
    prisma.account.findMany({ where: { ativa: true } }),
    prisma.investment.findMany({ where: { ativa: true } }),
    prisma.property.findMany({ include: { hipoteca: true } }),
    prisma.mortgage.findMany(),
  ]);

  return NextResponse.json({
    data: {
      totalAtivos,
      totalPassivos,
      netWorth,
      breakdown,
      contas: contas.map((c) => ({ nome: c.nome, saldo: toNumber(c.saldo), cor: c.cor })),
      investimentos: investimentos.map((i) => ({
        nome: i.nome,
        ticker: i.ticker,
        valor: toNumber(i.quantidade) * toNumber(i.valorAtualUnidade),
      })),
      imoveis: imoveis.map((p) => ({
        nome: p.nome,
        valorEstimado: toNumber(p.valorEstimado),
        capitalEmDivida: toNumber(p.hipoteca?.capitalEmDivida ?? 0),
        equity: toNumber(p.valorEstimado) - toNumber(p.hipoteca?.capitalEmDivida ?? 0),
      })),
    },
  });
}

