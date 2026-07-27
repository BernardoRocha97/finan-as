export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, subYears, format } from "date-fns";
import { pt } from "date-fns/locale";

function getPeriod(periodo: string, mesRef: string | null): { inicio: Date; fim: Date; meses: Date[] } {
  const ref = mesRef ? new Date(mesRef + "-01") : new Date();

  if (periodo === "mes") {
    const inicio = startOfMonth(ref);
    const fim = endOfMonth(ref);
    return { inicio, fim, meses: [inicio] };
  }
  if (periodo === "2meses") {
    const fim = endOfMonth(ref);
    const inicio = startOfMonth(subMonths(ref, 1));
    return { inicio, fim, meses: [subMonths(startOfMonth(ref), 1), startOfMonth(ref)] };
  }
  if (periodo === "6meses") {
    const fim = endOfMonth(ref);
    const inicio = startOfMonth(subMonths(ref, 5));
    return { inicio, fim, meses: Array.from({ length: 6 }, (_, i) => startOfMonth(subMonths(ref, 5 - i))) };
  }
  if (periodo === "ano") {
    const fim = endOfMonth(ref);
    const inicio = startOfMonth(subMonths(ref, 11));
    return { inicio, fim, meses: Array.from({ length: 12 }, (_, i) => startOfMonth(subMonths(ref, 11 - i))) };
  }
  if (periodo === "ano_atual") {
    const inicio = startOfYear(ref);
    const fim = endOfYear(ref);
    const n = ref.getMonth() + 1;
    return { inicio, fim, meses: Array.from({ length: n }, (_, i) => startOfMonth(new Date(ref.getFullYear(), i, 1))) };
  }
  if (periodo === "ano_anterior") {
    const ano = subYears(ref, 1);
    const inicio = startOfYear(ano);
    const fim = endOfYear(ano);
    return { inicio, fim, meses: Array.from({ length: 12 }, (_, i) => new Date(ano.getFullYear(), i, 1)) };
  }
  // default: mes atual
  return { inicio: startOfMonth(ref), fim: endOfMonth(ref), meses: [startOfMonth(ref)] };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const periodo = searchParams.get("periodo") ?? "mes";
  const mesRef = searchParams.get("mes"); // "YYYY-MM"

  const { inicio, fim, meses } = getPeriod(periodo, mesRef);

  // Fetch all transactions in range
  const transacoes = await prisma.transaction.findMany({
    where: { data: { gte: inicio, lte: fim } },
    include: { category: true, account: true },
    orderBy: { data: "desc" },
  });

  // Aggregate by month
  const porMes = meses.map((mesInicio) => {
    const mesFim = endOfMonth(mesInicio);
    const ts = transacoes.filter((t) => t.data >= mesInicio && t.data <= mesFim);
    const receitas = ts.filter((t) => t.tipo === "RECEITA").reduce((s, t) => s + toNumber(t.valor), 0);
    const despesas = ts.filter((t) => t.tipo === "DESPESA").reduce((s, t) => s + toNumber(t.valor), 0);
    return {
      mes: format(mesInicio, "MMM yy", { locale: pt }),
      mesLabel: format(mesInicio, "MMMM yyyy", { locale: pt }),
      data: mesInicio.toISOString(),
      receitas: Math.round(receitas * 100) / 100,
      despesas: Math.round(despesas * 100) / 100,
      saldo: Math.round((receitas - despesas) * 100) / 100,
      taxaPoupanca: receitas > 0 ? Math.round(((receitas - despesas) / receitas) * 1000) / 10 : 0,
    };
  });

  // By category (despesas)
  const catMap: Record<string, { nome: string; cor: string; valor: number; count: number }> = {};
  const incMap: Record<string, { nome: string; cor: string; valor: number; count: number }> = {};
  for (const t of transacoes) {
    const cat = t.category?.nome ?? "Outros";
    const cor = t.category?.cor ?? "#6b7280";
    if (t.tipo === "DESPESA") {
      if (!catMap[cat]) catMap[cat] = { nome: cat, cor, valor: 0, count: 0 };
      catMap[cat].valor += toNumber(t.valor);
      catMap[cat].count++;
    } else if (t.tipo === "RECEITA") {
      if (!incMap[cat]) incMap[cat] = { nome: cat, cor, valor: 0, count: 0 };
      incMap[cat].valor += toNumber(t.valor);
      incMap[cat].count++;
    }
  }

  const despesasCat = Object.values(catMap)
    .map((c) => ({ ...c, valor: Math.round(c.valor * 100) / 100 }))
    .sort((a, b) => b.valor - a.valor);

  const receitasCat = Object.values(incMap)
    .map((c) => ({ ...c, valor: Math.round(c.valor * 100) / 100 }))
    .sort((a, b) => b.valor - a.valor);

  // Top 10 despesas individuais
  const topDespesas = transacoes
    .filter((t) => t.tipo === "DESPESA")
    .slice(0, 50)
    .map((t) => ({
      id: t.id,
      data: t.data,
      descricao: t.descricao,
      valor: toNumber(t.valor),
      categoria: t.category?.nome ?? "Outros",
      categoriaCor: t.category?.cor ?? "#6b7280",
      conta: t.account?.nome ?? "",
    }));

  // Top receitas
  const topReceitas = transacoes
    .filter((t) => t.tipo === "RECEITA")
    .slice(0, 20)
    .map((t) => ({
      id: t.id,
      data: t.data,
      descricao: t.descricao,
      valor: toNumber(t.valor),
      categoria: t.category?.nome ?? "Outros",
      categoriaCor: t.category?.cor ?? "#6b7280",
      conta: t.account?.nome ?? "",
    }));

  // Totals
  const totalReceitas = transacoes.filter((t) => t.tipo === "RECEITA").reduce((s, t) => s + toNumber(t.valor), 0);
  const totalDespesas = transacoes.filter((t) => t.tipo === "DESPESA").reduce((s, t) => s + toNumber(t.valor), 0);

  return NextResponse.json({
    data: {
      porMes,
      despesasCat,
      receitasCat,
      topDespesas,
      topReceitas,
      totais: {
        receitas: Math.round(totalReceitas * 100) / 100,
        despesas: Math.round(totalDespesas * 100) / 100,
        saldo: Math.round((totalReceitas - totalDespesas) * 100) / 100,
        taxaPoupanca: totalReceitas > 0 ? Math.round(((totalReceitas - totalDespesas) / totalReceitas) * 1000) / 10 : 0,
      },
      periodo: { inicio: inicio.toISOString(), fim: fim.toISOString() },
    },
  });
}

