export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseBPI, parseCGD, parseMillennium, parseGenericCSV, parseRevolut } from "@/lib/parsers";
import { parseCGDXLS } from "@/lib/parsers/cgdXls";
import { categorizeTransaction } from "@/lib/categories";
import { toNumber } from "@/lib/utils";

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const banco = formData.get("banco") as string ?? "generico";
  const accountId = formData.get("accountId") as string;
  const action = formData.get("action") as string ?? "preview";
  // Indices that the user manually overrode (suspeito/duplicado → forçar incluir)
  const forceIncludeRaw = formData.get("forceInclude") as string ?? "[]";
  const forceInclude: number[] = JSON.parse(forceIncludeRaw);

  if (!file) return NextResponse.json({ error: "Ficheiro em falta" }, { status: 400 });

  const isXls = file.name.toLowerCase().endsWith(".xls") || file.name.toLowerCase().endsWith(".xlsx");
  let parsed;
  let saldoExtrato: number | null = null;

  if (isXls) {
    const buffer = await file.arrayBuffer();
    const result = parseCGDXLS(buffer);
    parsed = result.transactions;
    saldoExtrato = result.saldoFinal;
  } else {
    const text = await file.text();
    switch (banco) {
      case "bpi": parsed = parseBPI(text); break;
      case "cgd": parsed = parseCGD(text); break;
      case "millennium": parsed = parseMillennium(text); break;
      case "revolut": parsed = parseRevolut(text); break;
      default: parsed = parseGenericCSV(text);
    }
  }

  const withCats = await Promise.all(
    parsed.map(async (t) => ({
      ...t,
      categoryId: await categorizeTransaction(t.descricao),
    }))
  );

  const existing = await prisma.transaction.findMany({
    where: { accountId },
    select: { data: true, descricao: true, valor: true },
  });

  const results = withCats.map((t, idx) => {
    // If user forced this index, always mark as novo
    if (forceInclude.includes(idx)) return { ...t, status: "novo" };

    const sameValDate = existing.filter((e) => {
      const sameDate = Math.abs(new Date(e.data).getTime() - t.data.getTime()) < 86400000;
      const sameVal = Math.abs(toNumber(e.valor) - t.valor) < 0.01;
      return sameDate && sameVal;
    });

    if (!sameValDate.length) return { ...t, status: "novo" };

    // Mesma data + valor + descrição parecida → duplicado certo
    const exactOrClose = sameValDate.find((e) => {
      const dist = levenshtein(e.descricao.toLowerCase(), t.descricao.toLowerCase());
      return dist / Math.max(e.descricao.length, t.descricao.length, 1) < 0.3;
    });
    if (exactOrClose) return { ...t, status: "duplicado", matchDesc: exactOrClose.descricao };

    // Mesma data + valor mas descrição diferente → suspeito, pergunta ao utilizador
    return { ...t, status: "suspeito", matchDesc: sameValDate[0].descricao };
  });

  if (action === "preview") {
    return NextResponse.json({ data: results, total: results.length, saldoExtrato });
  }

  // Confirm — save "novo" only
  const toSave = results.filter((r) => r.status === "novo");
  let saved = 0;
  for (const t of toSave) {
    try {
      await prisma.transaction.create({
        data: {
          data: t.data,
          descricao: t.descricao,
          valor: t.valor,
          tipo: t.tipo,
          categoryId: t.categoryId,
          accountId,
          importada: true,
          revisada: false,
        },
      });
      saved++;
    } catch { /* skip */ }
  }

  let saldoFinal: number;
  if (saldoExtrato !== null) {
    saldoFinal = saldoExtrato;
  } else {
    const transacoes = await prisma.transaction.findMany({ where: { accountId, tipo: { not: "TRANSFERENCIA" } } });
    saldoFinal = transacoes.reduce((s, t) => (t.tipo === "RECEITA" ? s + toNumber(t.valor) : s - toNumber(t.valor)), 0);
  }
  await prisma.$executeRaw`UPDATE "Account" SET saldo = ${saldoFinal} WHERE id = ${accountId}`;

  const duplicadas = results.filter((r) => r.status === "duplicado").length;
  const suspeitas = results.filter((r) => r.status === "suspeito").length;

  await prisma.importLog.create({
    data: {
      ficheiro: file.name,
      formato: isXls ? "XLS" : "CSV",
      banco,
      totalLinhas: parsed.length,
      importadas: saved,
      duplicadas: duplicadas + suspeitas,
      erros: 0,
    },
  });

  const conta = await prisma.account.findUnique({ where: { id: accountId }, select: { nome: true } });
  return NextResponse.json({ data: { importadas: saved, duplicadas, suspeitas, saldoAtualizado: saldoFinal, contaNome: conta?.nome } });
}

export async function GET() {
  const logs = await prisma.importLog.findMany({ orderBy: { criadoEm: "desc" }, take: 20 });
  return NextResponse.json({ data: logs });
}
