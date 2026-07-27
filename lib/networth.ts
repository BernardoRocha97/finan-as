import { prisma } from "./prisma";
import { toNumber } from "./utils";
import { startOfMonth } from "date-fns";

export async function calcNetWorth() {
  const [contas, investimentos, imoveis, hipotecas] = await Promise.all([
    prisma.account.findMany({ where: { ativa: true } }),
    prisma.investment.findMany({ where: { ativa: true } }),
    prisma.property.findMany(),
    prisma.mortgage.findMany(),
  ]);

  const totalContas = contas.reduce((s, c) => s + toNumber(c.saldo), 0);
  const totalInvest = investimentos.reduce(
    (s, i) => s + toNumber(i.quantidade) * toNumber(i.valorAtualUnidade),
    0
  );
  const totalImoveis = imoveis.reduce((s, p) => s + toNumber(p.valorEstimado), 0);
  const totalHipotecas = hipotecas.reduce((s, h) => s + toNumber(h.capitalEmDivida), 0);

  const totalAtivos = totalContas + totalInvest + totalImoveis;
  const totalPassivos = totalHipotecas;
  const netWorth = totalAtivos - totalPassivos;

  return {
    totalAtivos,
    totalPassivos,
    netWorth,
    breakdown: { totalContas, totalInvest, totalImoveis, totalHipotecas },
  };
}

export async function ensureMonthlySnapshot() {
  const hoje = new Date();
  const mesAtual = startOfMonth(hoje);

  const exists = await prisma.netWorthSnapshot.findUnique({ where: { data: mesAtual } });
  if (exists) return;

  const { totalAtivos, totalPassivos, netWorth, breakdown } = await calcNetWorth();
  await prisma.netWorthSnapshot.create({
    data: {
      data: mesAtual,
      totalAtivos,
      totalPassivos,
      netWorth,
      breakdown: JSON.stringify(breakdown),
    },
  });
}

export function projectNetWorth(
  netWorthAtual: number,
  taxaPoupancaMensal: number,
  rendimentoAnual: number,
  anos: number
) {
  const scenarios = [-2, 0, 2].map((delta) => {
    const taxa = (rendimentoAnual + delta) / 100;
    const points: { ano: number; valor: number }[] = [];
    let valor = netWorthAtual;
    for (let a = 1; a <= anos; a++) {
      valor = valor * (1 + taxa) + taxaPoupancaMensal * 12;
      points.push({ ano: new Date().getFullYear() + a, valor: Math.round(valor) });
    }
    return { label: delta === 0 ? "base" : delta < 0 ? "conservador" : "otimista", points };
  });
  return scenarios;
}
