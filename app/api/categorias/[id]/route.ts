import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  nome: z.string().optional(),
  cor: z.string().optional(),
  icone: z.string().optional(),
  tipo: z.enum(["DESPESA", "RECEITA", "AMBOS"]).optional(),
  ativa: z.boolean().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const cat = await prisma.category.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ data: cat });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const count = await prisma.transaction.count({ where: { categoryId: id } });
  if (count > 0) return NextResponse.json({ error: "Categoria tem transações associadas" }, { status: 400 });

  await prisma.category.update({ where: { id }, data: { ativa: false } });
  return NextResponse.json({ data: { ok: true } });
}
