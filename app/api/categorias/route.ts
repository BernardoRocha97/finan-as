export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  nome: z.string().min(1),
  cor: z.string().default("#6b7280"),
  icone: z.string().default("tag"),
  tipo: z.enum(["DESPESA", "RECEITA", "AMBOS"]).default("AMBOS"),
  parentId: z.string().optional().nullable(),
});

export async function GET() {
  const cats = await prisma.category.findMany({
    where: { ativa: true, parentId: null },
    include: { filhas: { where: { ativa: true } } },
    orderBy: { nome: "asc" },
  });
  return NextResponse.json({ data: cats });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const cat = await prisma.category.create({ data: parsed.data });
  return NextResponse.json({ data: cat }, { status: 201 });
}

