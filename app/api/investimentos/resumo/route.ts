export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";

export async function GET() {
  const investimentos = await prisma.investment.findMany({ where: { ativa: true } });

  let valorTotal = 0;
  let custoTotal = 0;
  const porTipo: Record<string, number> = {};

  for (const i of investimentos) {
    const vt = toNumber(i.quantidade) * toNumber(i.valorAtualUnidade);
    const ct = toNumber(i.quantidade) * toNumber(i.precoMedioCompra);
    valorTotal += vt;
    custoTotal += ct;
    porTipo[i.tipo] = (porTipo[i.tipo] ?? 0) + vt;
  }

  return NextResponse.json({
    data: {
      valorTotal,
      custoTotal,
      ganhoPerda: valorTotal - custoTotal,
      ganhoPerdaPercent: custoTotal > 0 ? ((valorTotal - custoTotal) / custoTotal) * 100 : 0,
      porTipo,
    },
  });
}

