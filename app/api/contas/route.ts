export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  nome: z.string().min(1),
  tipo: z.enum(["CORRENTE", "POUPANCA", "INVESTIMENTO", "OUTROS"]).default("CORRENTE"),
  saldo: z.number().default(0),
  banco: z.string().min(1),
  iban: z.string().nullable().optional(),
  cor: z.string().default("#3b82f6"),
  notas: z.string().nullable().optional(),
  taxaJuroPoupanca: z.number().nullable().optional(),
});

export async function GET() {
  const contas = await prisma.account.findMany({
    where: { ativa: true },
    orderBy: { criadoEm: "asc" },
  });
  return NextResponse.json({ data: contas });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const conta = await prisma.account.create({ data: parsed.data });
  return NextResponse.json({ data: conta }, { status: 201 });
}

