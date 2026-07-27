export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { toNumber } from "@/lib/utils";

const schema = z.object({
  nome: z.string().min(1),
  ticker: z.string().min(1),
  tipo: z.enum(["ETF", "ACAO", "PPR", "CRIPTO", "OBRIGACAO", "OUTRO"]),
  quantidade: z.number().default(0),
  precoMedioCompra: z.number().default(0),
  valorAtualUnidade: z.number().default(0),
  plataforma: z.string().optional(),
  notas: z.string().optional(),
});

export async function GET() {
  const investimentos = await prisma.investment.findMany({
    where: { ativa: true },
    orderBy: { criadoEm: "asc" },
  });

  const data = investimentos.map((i) => ({
    ...i,
    valorTotal: toNumber(i.quantidade) * toNumber(i.valorAtualUnidade),
    custo: toNumber(i.quantidade) * toNumber(i.precoMedioCompra),
    ganhoPerda:
      toNumber(i.quantidade) * toNumber(i.valorAtualUnidade) -
      toNumber(i.quantidade) * toNumber(i.precoMedioCompra),
  }));

  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const inv = await prisma.investment.create({ data: parsed.data });
  return NextResponse.json({ data: inv }, { status: 201 });
}

