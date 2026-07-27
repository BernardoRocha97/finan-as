export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { startOfMonth, endOfMonth } from "date-fns";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const inicio = searchParams.get("inicio")
    ? new Date(searchParams.get("inicio")!)
    : startOfMonth(new Date());
  const fim = searchParams.get("fim")
    ? new Date(searchParams.get("fim")!)
    : endOfMonth(new Date());

  const transacoes = await prisma.transaction.findMany({
    where: { data: { gte: inicio, lte: fim }, tipo: "DESPESA" },
    include: { category: true },
  });

  const porCategoria: Record<string, { nome: string; cor: string; valor: number }> = {};
  for (const t of transacoes) {
    const cat = t.category?.nome ?? "Outros";
    const cor = t.category?.cor ?? "#6b7280";
    if (!porCategoria[cat]) porCategoria[cat] = { nome: cat, cor, valor: 0 };
    porCategoria[cat].valor += toNumber(t.valor);
  }

  return NextResponse.json({
    data: Object.values(porCategoria).sort((a, b) => b.valor - a.valor),
  });
}

