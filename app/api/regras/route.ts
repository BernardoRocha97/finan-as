export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const regras = await prisma.categoryRule.findMany({
    include: { category: true },
    orderBy: { prioridade: "desc" },
  });
  return NextResponse.json({ data: regras });
}

export async function POST(req: NextRequest) {
  const { padrao, categoryId } = await req.json();
  if (!padrao || !categoryId) return NextResponse.json({ error: "Dados em falta" }, { status: 400 });
  const existing = await prisma.categoryRule.findFirst({ where: { padrao } });
  if (existing) {
    await prisma.categoryRule.update({ where: { id: existing.id }, data: { categoryId } });
  } else {
    await prisma.categoryRule.create({ data: { padrao, categoryId, prioridade: 0 } });
  }
  return NextResponse.json({ data: { ok: true } });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  await prisma.categoryRule.delete({ where: { id } });
  return NextResponse.json({ data: { ok: true } });
}

