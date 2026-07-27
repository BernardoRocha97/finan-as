import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { toNumber } from "@/lib/utils";

const schema = z.object({
  data: z.string().optional(),
  descricao: z.string().optional(),
  valor: z.number().positive().optional(),
  tipo: z.enum(["DESPESA", "RECEITA", "TRANSFERENCIA"]).optional(),
  categoryId: z.string().optional().nullable(),
  accountId: z.string().optional(),
  notas: z.string().optional(),
  revisada: z.boolean().optional(),
});

async function recalcSaldo(accountId: string) {
  const transacoes = await prisma.transaction.findMany({ where: { accountId, tipo: { not: "TRANSFERENCIA" } } });
  const base = transacoes.reduce((s, t) => (t.tipo === "RECEITA" ? s + toNumber(t.valor) : s - toNumber(t.valor)), 0);
  const transfersIn = await prisma.transaction.findMany({ where: { accountDestId: accountId, tipo: "TRANSFERENCIA" } });
  const transfersOut = await prisma.transaction.findMany({ where: { accountId, tipo: "TRANSFERENCIA" } });
  const saldo =
    base +
    transfersIn.reduce((s, t) => s + toNumber(t.valor), 0) -
    transfersOut.reduce((s, t) => s + toNumber(t.valor), 0);
  await prisma.account.update({ where: { id: accountId }, data: { saldo } });
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await prisma.transaction.findUnique({
    where: { id },
    include: { category: true, account: true, accountDest: true },
  });
  if (!t) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });
  return NextResponse.json({ data: t });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: d, ...rest } = parsed.data;
  const old = await prisma.transaction.findUnique({ where: { id } });
  const t = await prisma.transaction.update({
    where: { id },
    data: { ...rest, ...(d ? { data: new Date(d) } : {}) },
  });

  await recalcSaldo(t.accountId);
  if (old?.accountId && old.accountId !== t.accountId) await recalcSaldo(old.accountId);

  return NextResponse.json({ data: t });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await prisma.transaction.delete({ where: { id } });
  await recalcSaldo(t.accountId);
  return NextResponse.json({ data: { ok: true } });
}
