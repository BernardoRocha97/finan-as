export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcNetWorth, ensureMonthlySnapshot, projectNetWorth } from "@/lib/networth";
import { toNumber } from "@/lib/utils";
import { startOfMonth, subMonths } from "date-fns";

export async function GET() {
  await ensureMonthlySnapshot();

  const snapshots = await prisma.netWorthSnapshot.findMany({
    orderBy: { data: "asc" },
    take: 24,
  });

  const atual = await calcNetWorth();

  // Avg savings rate from last 3 months
  const inicio3m = startOfMonth(subMonths(new Date(), 3));
  const transacoes3m = await prisma.transaction.findMany({
    where: { data: { gte: inicio3m } },
  });
  const receitas = transacoes3m.filter((t) => t.tipo === "RECEITA").reduce((s, t) => s + toNumber(t.valor), 0);
  const despesas = transacoes3m.filter((t) => t.tipo === "DESPESA").reduce((s, t) => s + toNumber(t.valor), 0);
  const poupancaMensal = Math.max(0, (receitas - despesas) / 3);

  const prefs = await prisma.preference.findUnique({ where: { id: "singleton" } });
  const taxa = toNumber(prefs?.rendimentoAnualEsperado ?? 7);

  const projecoes = projectNetWorth(atual.netWorth, poupancaMensal, taxa, 20);

  return NextResponse.json({
    data: {
      historico: snapshots,
      atual,
      projecoes,
      poupancaMensal,
    },
  });
}

