export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { startOfMonth, subMonths, format, addMonths, differenceInCalendarMonths } from "date-fns";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const inicioParam = searchParams.get("inicio");
  const fimParam = searchParams.get("fim");

  let primeiromes: Date;
  let ultimomes: Date;

  if (inicioParam && fimParam) {
    primeiromes = startOfMonth(new Date(inicioParam));
    ultimomes = startOfMonth(new Date(fimParam));
  } else {
    primeiromes = startOfMonth(subMonths(new Date(), 11));
    ultimomes = startOfMonth(new Date());
  }

  const totalMeses = differenceInCalendarMonths(ultimomes, primeiromes) + 1;
  const meses = Array.from({ length: totalMeses }, (_, i) => addMonths(primeiromes, i));

  const result = await Promise.all(
    meses.map(async (inicio) => {
      const fim = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0, 23, 59, 59);
      const transacoes = await prisma.transaction.findMany({
        where: { data: { gte: inicio, lte: fim } },
      });
      const receitas = transacoes.filter((t) => t.tipo === "RECEITA").reduce((s, t) => s + toNumber(t.valor), 0);
      const despesas = transacoes.filter((t) => t.tipo === "DESPESA").reduce((s, t) => s + toNumber(t.valor), 0);
      return {
        mes: format(inicio, "MMM yy"),
        data: inicio.toISOString(),
        receitas: Math.round(receitas * 100) / 100,
        despesas: Math.round(despesas * 100) / 100,
        saldo: Math.round((receitas - despesas) * 100) / 100,
      };
    })
  );

  return NextResponse.json({ data: result });
}

