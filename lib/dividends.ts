import { prisma } from "./prisma";
import { toNumber } from "./utils";
import { subMonths } from "date-fns";

export async function calcDividendYield(investmentId: string): Promise<number> {
  const investment = await prisma.investment.findUnique({ where: { id: investmentId } });
  if (!investment) return 0;

  const since = subMonths(new Date(), 12);
  const ops = await prisma.investmentTransaction.findMany({
    where: { investmentId, tipo: "DIVIDENDO", data: { gte: since } },
  });

  const totalDividends = ops.reduce((s, o) => s + toNumber(o.valorDividendo), 0);
  const valorTotal = toNumber(investment.quantidade) * toNumber(investment.valorAtualUnidade);

  if (valorTotal === 0) return 0;

  // Extrapolate if less than 12 months of history
  const monthsWithData = ops.length > 0 ? 12 : 0;
  const annualized = monthsWithData > 0 ? (totalDividends / monthsWithData) * 12 : totalDividends;

  return valorTotal > 0 ? (annualized / valorTotal) * 100 : 0;
}

export async function updateDividendYield(investmentId: string) {
  const yield_ = await calcDividendYield(investmentId);
  await prisma.investment.update({
    where: { id: investmentId },
    data: { dividendYieldCalculado: yield_ },
  });
  return yield_;
}

export function projectPortfolio(
  valorAtual: number,
  contribuicaoMensal: number,
  taxaCrescimentoAnual: number,
  dividendYieldMedio: number,
  anos: number
) {
  const scenarios = [-2, 0, 2].map((delta) => {
    const taxa = (taxaCrescimentoAnual + delta) / 100;
    const yieldRate = dividendYieldMedio / 100;
    const rows: {
      ano: number;
      valorCarteira: number;
      contribuicoesAno: number;
      dividendosAno: number;
      rendimentoAno: number;
      ganhoAcumulado: number;
    }[] = [];

    let valor = valorAtual;
    const anoBase = new Date().getFullYear();

    for (let a = 1; a <= anos; a++) {
      const contribuicoesAno = contribuicaoMensal * 12;
      const dividendosAno = valor * yieldRate;
      const rendimentoAno = valor * taxa;
      valor = valor + rendimentoAno + contribuicoesAno + dividendosAno;
      rows.push({
        ano: anoBase + a,
        valorCarteira: Math.round(valor),
        contribuicoesAno: Math.round(contribuicoesAno),
        dividendosAno: Math.round(dividendosAno),
        rendimentoAno: Math.round(rendimentoAno),
        ganhoAcumulado: Math.round(valor - valorAtual),
      });
    }
    return { label: delta === 0 ? "base" : delta < 0 ? "conservador" : "otimista", rows };
  });
  return scenarios;
}
