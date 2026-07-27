export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const obj = await prisma.goal.update({ where: { id }, data: body });
  return NextResponse.json({ data: obj });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.goal.update({ where: { id }, data: { ativa: false } });
  return NextResponse.json({ data: { ok: true } });
}

const contribSchema = z.object({ valor: z.number().positive(), data: z.string().optional(), notas: z.string().optional() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = contribSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const contrib = await prisma.goalContribution.create({
    data: { goalId: id, valor: parsed.data.valor, notas: parsed.data.notas,
      ...(parsed.data.data ? { data: new Date(parsed.data.data) } : {}),
    },
  });
  // Update valorAtual
  const all = await prisma.goalContribution.aggregate({ where: { goalId: id }, _sum: { valor: true } });
  await prisma.goal.update({ where: { id }, data: { valorAtual: all._sum.valor ?? 0 } });

  return NextResponse.json({ data: contrib }, { status: 201 });
}
