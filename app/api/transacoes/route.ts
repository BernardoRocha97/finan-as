export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { toNumber } from "@/lib/utils";

const schema = z.object({
  data: z.string(),
  descricao: z.string().min(1),
  valor: z.number().positive(),
  tipo: z.enum(["DESPESA", "RECEITA", "TRANSFERENCIA"]),
  categoryId: z.string().optional().nullable(),
  accountId: z.string(),
  accountDestId: z.string().optional().nullable(),
  notas: z.string().optional(),
  referencia: z.string().optional(),
  revisada: z.boolean().default(true),
});

async function recalcSaldo(accountId: string) {
  const transacoes = await prisma.transaction.findMany({
    where: { accountId, tipo: { not: "TRANSFERENCIA" } },
  });
  const saldo = transacoes.reduce((s, t) => {
    return t.tipo === "RECEITA" ? s + toNumber(t.valor) : s - toNumber(t.valor);
  }, 0);
  // Also add transfers in
  const transfersIn = await prisma.transaction.findMany({
    where: { accountDestId: accountId, tipo: "TRANSFERENCIA" },
  });
  const transfersOut = await prisma.transaction.findMany({
    where: { accountId, tipo: "TRANSFERENCIA" },
  });
  const saldoFinal =
    saldo +
    transfersIn.reduce((s, t) => s + toNumber(t.valor), 0) -
    transfersOut.reduce((s, t) => s + toNumber(t.valor), 0);
  await prisma.account.update({ where: { id: accountId }, data: { saldo: saldoFinal } });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const where: Record<string, unknown> = {};

  const accountId = searchParams.get("accountId");
  const categoryId = searchParams.get("categoryId");
  const tipo = searchParams.get("tipo");
  const texto = searchParams.get("texto");
  const inicio = searchParams.get("inicio");
  const fim = searchParams.get("fim");
  const pagina = Number(searchParams.get("pagina") ?? 1);
  const limite = Number(searchParams.get("limite") ?? 50);
  const naoRevisadas = searchParams.get("naoRevisadas");

  if (accountId) where.accountId = accountId;
  if (categoryId) where.categoryId = categoryId;
  if (tipo) where.tipo = tipo;
  if (naoRevisadas === "1") where.revisada = false;
  if (texto) where.descricao = { contains: texto };
  if (inicio || fim) {
    where.data = {};
    if (inicio) (where.data as Record<string, Date>).gte = new Date(inicio);
    if (fim) (where.data as Record<string, Date>).lte = new Date(fim);
  }

  const [total, transacoes] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      include: { category: true, account: true, accountDest: true },
      orderBy: { data: "desc" },
      skip: (pagina - 1) * limite,
      take: limite,
    }),
  ]);

  return NextResponse.json({ data: transacoes, total, pagina, limite });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: d, ...rest } = parsed.data;
  const transacao = await prisma.transaction.create({
    data: { ...rest, data: new Date(d) },
  });

  return NextResponse.json({ data: transacao }, { status: 201 });
}

