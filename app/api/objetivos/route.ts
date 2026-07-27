export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { toNumber } from "@/lib/utils";
import { startOfMonth, endOfMonth } from "date-fns";

const schema = z.object({
  nome: z.string().min(1),
  tipo: z.enum(["POUPANCA", "ORCAMENTO_MENSAL", "ORCAMENTO_ANUAL"]),
  valorAlvo: z.number().positive(),
  valorAtual: z.number().default(0),
  dataInicio: z.string().optional(),
  dataLimite: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  cor: z.string().default("#10b981"),
  icone: z.string().default("target"),
  notas: z.string().optional(),
});

export async function GET() {
  const objetivos = await prisma.goal.findMany({
    where: { ativa: true },
    include: { category: true, contribuicoes: { orderBy: { data: "desc" }, take: 5 } },
    orderBy: { criadoEm: "desc" },
  });

  const hoje = new Date();
  const mesInicio = startOfMonth(hoje);
  const mesFim = endOfMonth(hoje);

  // For monthly budgets, calculate current spending
  const result = await Promise.all(
    objetivos.map(async (obj) => {
      if (obj.tipo === "ORCAMENTO_MENSAL" && obj.categoryId) {
        const gasto = await prisma.transaction.aggregate({
          where: {
            categoryId: obj.categoryId,
            tipo: "DESPESA",
            data: { gte: mesInicio, lte: mesFim },
          },
          _sum: { valor: true },
        });
        return { ...obj, valorAtual: toNumber(gasto._sum.valor) };
      }
      return obj;
    })
  );

  return NextResponse.json({ data: result });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { dataInicio, dataLimite, ...rest } = parsed.data;
  const obj = await prisma.goal.create({
    data: {
      ...rest,
      ...(dataInicio ? { dataInicio: new Date(dataInicio) } : {}),
      ...(dataLimite ? { dataLimite: new Date(dataLimite) } : {}),
    },
  });
  return NextResponse.json({ data: obj }, { status: 201 });
}

