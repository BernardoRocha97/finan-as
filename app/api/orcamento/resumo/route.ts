export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { startOfMonth, endOfMonth, subMonths, getDaysInMonth, getDate, format } from "date-fns";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mesParam = searchParams.get("mes"); // YYYY-MM

  const refDate = mesParam ? new Date(`${mesParam}-01`) : new Date();
  const mesInicio = startOfMonth(refDate);
  const mesFim = endOfMonth(refDate);
  const isCurrentMonth = startOfMonth(new Date()).getTime() === mesInicio.getTime();

  // All active monthly budgets
  const orcamentos = await prisma.goal.findMany({
    where: { ativa: true, tipo: "ORCAMENTO_MENSAL" },
    include: { category: true },
    orderBy: { criadoEm: "asc" },
  });

  // All categories (for unbudgeted view)
  const categorias = await prisma.category.findMany({ where: { ativa: true } });

  // Category IDs with a budget
  const budgetedCatIds = new Set(orcamentos.map((o) => o.categoryId).filter(Boolean));

  // Build 4-month history window (3 past + current)
  const mesesHist = [3, 2, 1, 0].map((n) => subMonths(mesInicio, n));

  // Get spending for all categories in those months in one query
  const transacoes = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      tipo: "DESPESA",
      data: {
        gte: startOfMonth(mesesHist[0]),
        lte: mesFim,
      },
    },
    _sum: { valor: true },
  });

  // Month-by-month per category
  const spendByMonthCat: Record<string, Record<string, number>> = {};
  for (const m of mesesHist) {
    const key = format(m, "yyyy-MM");
    const rows = await prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        tipo: "DESPESA",
        data: { gte: startOfMonth(m), lte: endOfMonth(m) },
      },
      _sum: { valor: true },
    });
    spendByMonthCat[key] = {};
    for (const r of rows) {
      if (r.categoryId) spendByMonthCat[key][r.categoryId] = toNumber(r._sum.valor);
    }
  }

  // Projection helpers (only for current month)
  const diaAtual = isCurrentMonth ? getDate(new Date()) : getDaysInMonth(refDate);
  const diasMes = getDaysInMonth(refDate);
  const pctMesDecorrido = diaAtual / diasMes;

  // Enrich each budget
  const enriched = orcamentos.map((o) => {
    const catId = o.categoryId ?? "";
    const historico = mesesHist.map((m) => ({
      mes: format(m, "MMM yy"),
      key: format(m, "yyyy-MM"),
      gasto: spendByMonthCat[format(m, "yyyy-MM")]?.[catId] ?? 0,
    }));

    const gastoMes = historico[historico.length - 1].gasto;
    const limite = toNumber(o.valorAlvo);
    const pct = limite > 0 ? (gastoMes / limite) * 100 : 0;
    const projecaoFimMes = isCurrentMonth && pctMesDecorrido > 0
      ? gastoMes / pctMesDecorrido
      : gastoMes;
    const mediaUlt3m = historico.slice(0, 3).reduce((s, h) => s + h.gasto, 0) / 3;

    return {
      id: o.id, nome: o.nome, cor: o.cor,
      categoria: o.category ? { id: o.category.id, nome: o.category.nome, cor: o.category.cor } : null,
      limite, gastoMes, pct,
      projecaoFimMes: Math.round(projecaoFimMes),
      mediaUlt3m: Math.round(mediaUlt3m),
      historico: historico.slice(0, 3), // 3 meses passados
      diaAtual, diasMes,
    };
  });

  // Unbudgeted categories with spending this month + 3-month average
  const mesKey = format(mesInicio, "yyyy-MM");
  const unbudgeted = categorias
    .filter((c) => !budgetedCatIds.has(c.id))
    .map((c) => {
      const gastoMes = spendByMonthCat[mesKey]?.[c.id] ?? 0;
      const mediaUlt3m = Math.round(
        mesesHist.slice(0, 3).reduce((s, m) => s + (spendByMonthCat[format(m, "yyyy-MM")]?.[c.id] ?? 0), 0) / 3
      );
      return { id: c.id, nome: c.nome, cor: c.cor, gastoMes, mediaUlt3m };
    })
    .filter((c) => c.gastoMes > 0 || c.mediaUlt3m > 0)
    .sort((a, b) => b.mediaUlt3m - a.mediaUlt3m);

  // Totals
  const totalLimite = enriched.reduce((s, o) => s + o.limite, 0);
  const totalGasto = enriched.reduce((s, o) => s + o.gastoMes, 0);
  const totalProjecao = enriched.reduce((s, o) => s + o.projecaoFimMes, 0);

  return NextResponse.json({
    data: {
      mes: format(mesInicio, "yyyy-MM"),
      mesLabel: format(mesInicio, "MMMM yyyy"),
      isCurrentMonth,
      diaAtual, diasMes,
      orcamentos: enriched,
      unbudgeted,
      totais: { totalLimite, totalGasto, totalProjecao, pct: totalLimite > 0 ? (totalGasto / totalLimite) * 100 : 0 },
    },
  });
}

