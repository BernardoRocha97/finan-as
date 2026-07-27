import { prisma } from "./prisma";
import { toNumber } from "./utils";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";

export async function generateMonthlyReport(ano: number, mes: number) {
  const existing = await prisma.monthlyReport.findUnique({ where: { ano_mes: { ano, mes } } });
  if (existing) return existing;

  const start = startOfMonth(new Date(ano, mes - 1));
  const end = endOfMonth(start);

  const transacoes = await prisma.transaction.findMany({
    where: { data: { gte: start, lte: end } },
    include: { category: true },
  });

  const totalReceitas = transacoes
    .filter((t) => t.tipo === "RECEITA")
    .reduce((s, t) => s + toNumber(t.valor), 0);

  const totalDespesas = transacoes
    .filter((t) => t.tipo === "DESPESA")
    .reduce((s, t) => s + toNumber(t.valor), 0);

  const saldo = totalReceitas - totalDespesas;
  const taxaPoupanca = totalReceitas > 0 ? (saldo / totalReceitas) * 100 : 0;

  const despesasPorCategoria: Record<string, number> = {};
  for (const t of transacoes.filter((t) => t.tipo === "DESPESA")) {
    const cat = t.category?.nome ?? "Outros";
    despesasPorCategoria[cat] = (despesasPorCategoria[cat] ?? 0) + toNumber(t.valor);
  }

  // Previous month comparison
  const prevStart = startOfMonth(subMonths(start, 1));
  const prevEnd = endOfMonth(prevStart);
  const prevTransacoes = await prisma.transaction.findMany({
    where: { data: { gte: prevStart, lte: prevEnd } },
    include: { category: true },
  });
  const prevDespesas: Record<string, number> = {};
  for (const t of prevTransacoes.filter((t) => t.tipo === "DESPESA")) {
    const cat = t.category?.nome ?? "Outros";
    prevDespesas[cat] = (prevDespesas[cat] ?? 0) + toNumber(t.valor);
  }

  const comparacaoMesAnterior: Record<string, { atual: number; anterior: number; delta: number }> = {};
  const allCats = new Set([...Object.keys(despesasPorCategoria), ...Object.keys(prevDespesas)]);
  for (const cat of allCats) {
    const atual = despesasPorCategoria[cat] ?? 0;
    const anterior = prevDespesas[cat] ?? 0;
    comparacaoMesAnterior[cat] = { atual, anterior, delta: atual - anterior };
  }

  return prisma.monthlyReport.create({
    data: {
      ano,
      mes,
      totalReceitas,
      totalDespesas,
      saldo,
      taxaPoupanca,
      despesasPorCategoria: JSON.stringify(despesasPorCategoria),
      comparacaoMesAnterior: JSON.stringify(comparacaoMesAnterior),
    },
  });
}
