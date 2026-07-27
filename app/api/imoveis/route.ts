export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { toNumber } from "@/lib/utils";

const schema = z.object({
  nome: z.string().min(1),
  morada: z.string().optional(),
  valorEstimado: z.number().positive(),
  valorCompra: z.number().positive(),
  dataCompra: z.string(),
  cor: z.string().default("#f59e0b"),
  notas: z.string().optional(),
});

export async function GET() {
  const imoveis = await prisma.property.findMany({
    include: { hipoteca: true },
    orderBy: { criadoEm: "desc" },
  });

  const data = imoveis.map((p) => ({
    ...p,
    equity: toNumber(p.valorEstimado) - toNumber(p.hipoteca?.capitalEmDivida ?? 0),
    valorizacao:
      toNumber(p.valorCompra) > 0
        ? ((toNumber(p.valorEstimado) - toNumber(p.valorCompra)) / toNumber(p.valorCompra)) * 100
        : 0,
  }));

  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { dataCompra, ...rest } = parsed.data;
  const imovel = await prisma.property.create({ data: { ...rest, dataCompra: new Date(dataCompra) } });
  return NextResponse.json({ data: imovel }, { status: 201 });
}

