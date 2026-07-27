import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";

export async function gerarRelatorio() {
  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59);

  const [contas, transacoesMes, semCategoria] = await Promise.all([
    prisma.account.findMany({ where: { ativa: true }, orderBy: { criadoEm: "asc" } }),
    prisma.transaction.findMany({
      where: { data: { gte: inicioMes, lte: fimMes } },
      include: { category: true, account: true },
      orderBy: { data: "desc" },
    }),
    prisma.transaction.count({
      where: { OR: [{ categoryId: null }, { categoryId: "Outros" }] },
    }),
  ]);

  const totalSaldo = contas.reduce((s, c) => s + toNumber(c.saldo), 0);
  const receitas = transacoesMes.filter((t) => t.tipo === "RECEITA").reduce((s, t) => s + toNumber(t.valor), 0);
  const despesas = transacoesMes.filter((t) => t.tipo === "DESPESA").reduce((s, t) => s + toNumber(t.valor), 0);

  // Top categorias por despesa
  const porCategoria: Record<string, number> = {};
  for (const t of transacoesMes.filter((t) => t.tipo === "DESPESA")) {
    const nome = t.category?.nome ?? "Sem categoria";
    porCategoria[nome] = (porCategoria[nome] ?? 0) + toNumber(t.valor);
  }
  const topCategorias = Object.entries(porCategoria)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Últimas 10 transações
  const ultimas = transacoesMes.slice(0, 10);

  return {
    data: agora,
    totalSaldo,
    contas,
    receitas,
    despesas,
    saldo: receitas - despesas,
    topCategorias,
    ultimas,
    semCategoria,
    totalTransacoes: transacoesMes.length,
  };
}

export function formatCur(v: number) {
  return v.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}
