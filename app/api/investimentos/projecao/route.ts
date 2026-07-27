export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { projectPortfolio } from "@/lib/dividends";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const anos = Number(searchParams.get("anos") ?? 20);
  const contribuicaoMensal = Number(searchParams.get("contribuicao") ?? 0);

  const prefs = await prisma.preference.findUnique({ where: { id: "singleton" } });
  const taxaCrescimento = toNumber(prefs?.rendimentoAnualEsperado ?? 7);

  const investimentos = await prisma.investment.findMany({ where: { ativa: true } });
  const valorAtual = investimentos.reduce(
    (s, i) => s + toNumber(i.quantidade) * toNumber(i.valorAtualUnidade),
    0
  );
  const totalYield =
    investimentos.length > 0
      ? investimentos.reduce((s, i) => s + toNumber(i.dividendYieldCalculado), 0) / investimentos.length
      : 0;

  const scenarios = projectPortfolio(valorAtual, contribuicaoMensal, taxaCrescimento, totalYield, anos);
  return NextResponse.json({ data: scenarios, valorAtual, taxaCrescimento, dividendYieldMedio: totalYield });
}

