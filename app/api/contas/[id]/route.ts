export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  nome: z.string().min(1).optional(),
  tipo: z.enum(["CORRENTE", "POUPANCA", "INVESTIMENTO", "OUTROS"]).optional(),
  saldo: z.number().optional(),
  banco: z.string().optional(),
  iban: z.string().nullable().optional(),
  cor: z.string().optional(),
  notas: z.string().nullable().optional(),
  ativa: z.boolean().optional(),
});

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conta = await prisma.account.findUnique({
    where: { id },
    include: { transacoes: { orderBy: { data: "desc" }, take: 20, include: { category: true } } },
  });
  if (!conta) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });
  return NextResponse.json({ data: conta });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const conta = await prisma.account.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ data: conta });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.account.update({ where: { id }, data: { ativa: false } });
  return NextResponse.json({ data: { ok: true } });
}
