export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";

export async function GET() {
  const [investimentos, transacoes] = await Promise.all([
    prisma.investment.findMany({ where: { ativa: true } }),
    prisma.investmentTransaction.findMany({ where: { tipo: { in: ["COMPRA", "DIVIDENDO"] } }, select: { tipo: true, data: true, valorDividendo: true } }),
  ]);

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

  const totalDividendos = transacoes
    .filter((t) => t.tipo === "DIVIDENDO")
    .reduce((s, t) => s + toNumber(t.valorDividendo), 0);

  const compras = transacoes.filter((t) => t.tipo === "COMPRA");
  const primeiraCompra = compras.length > 0
    ? new Date(Math.min(...compras.map((t) => new Date(t.data).getTime())))
    : null;

  const anosInvestido = primeiraCompra
    ? Math.max(0.1, (Date.now() - primeiraCompra.getTime()) / (365.25 * 24 * 3600 * 1000))
    : 1;

  const ganhoPerda = valorTotal - custoTotal;
  const ganhoPerdaPercent = custoTotal > 0 ? (ganhoPerda / custoTotal) * 100 : 0;

  // Total return including dividends
  const totalReturnAbs = ganhoPerda + totalDividendos;
  const totalReturnPercent = custoTotal > 0 ? (totalReturnAbs / custoTotal) * 100 : 0;

  // Annualized total return (CAGR)
  const totalReturnAnualizado = custoTotal > 0
    ? (Math.pow(1 + totalReturnAbs / custoTotal, 1 / anosInvestido) - 1) * 100
    : 0;

  return NextResponse.json({
    data: {
      valorTotal,
      custoTotal,
      ganhoPerda,
      ganhoPerdaPercent,
      totalDividendos,
      totalReturnPercent,
      totalReturnAnualizado,
      anosInvestido: Math.round(anosInvestido * 10) / 10,
      porTipo,
    },
  });
}

