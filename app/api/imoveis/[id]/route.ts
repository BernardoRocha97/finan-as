import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { toNumber } from "@/lib/utils";

const hipotecaSchema = z.object({
  banco: z.string().min(1),
  valorInicial: z.number().positive(),
  capitalEmDivida: z.number(),
  taxaJuro: z.number(),
  tipoTaxa: z.enum(["FIXA", "VARIAVEL_EURIBOR"]).default("FIXA"),
  spread: z.number().default(0),
  prestacaoMensal: z.number().positive(),
  dataInicio: z.string(),
  prazoAnos: z.number().int().positive(),
});

const pagamentoSchema = z.object({
  data: z.string(),
  valorPago: z.number().positive(),
  capitalAmortizado: z.number(),
  juros: z.number(),
  notas: z.string().optional(),
});

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const imovel = await prisma.property.findUnique({
    where: { id },
    include: { hipoteca: { include: { pagamentos: { orderBy: { data: "desc" } } } } },
  });
  if (!imovel) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json({ data: imovel });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  try {
    const imovel = await prisma.property.update({
      where: { id },
      data: {
        nome: body.nome,
        morada: body.morada ?? null,
        valorEstimado: Number(body.valorEstimado),
        valorCompra: Number(body.valorCompra),
        dataCompra: new Date(body.dataCompra),
        areaMt2: body.areaMt2 != null ? Number(body.areaMt2) : null,
        precoPorMt2: body.precoPorMt2 != null ? Number(body.precoPorMt2) : null,
        cor: body.cor,
        notas: body.notas ?? null,
      },
    });
    return NextResponse.json({ data: imovel });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.property.delete({ where: { id } });
  return NextResponse.json({ data: { ok: true } });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  if (body._action === "hipoteca") {
    const parsed = hipotecaSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { dataInicio, ...rest } = parsed.data;
    const hipoteca = await prisma.mortgage.upsert({
      where: { propertyId: id },
      create: { ...rest, propertyId: id, dataInicio: new Date(dataInicio) },
      update: { ...rest, dataInicio: new Date(dataInicio) },
    });
    return NextResponse.json({ data: hipoteca }, { status: 201 });
  }

  if (body._action === "pagamento") {
    const hipoteca = await prisma.mortgage.findUnique({ where: { propertyId: id } });
    if (!hipoteca) return NextResponse.json({ error: "Sem hipoteca" }, { status: 404 });
    const parsed = pagamentoSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { data: d, ...rest } = parsed.data;
    const pag = await prisma.mortgagePayment.create({
      data: { ...rest, mortgageId: hipoteca.id, data: new Date(d) },
    });
    // Update capital em dívida
    await prisma.mortgage.update({
      where: { id: hipoteca.id },
      data: { capitalEmDivida: toNumber(hipoteca.capitalEmDivida) - rest.capitalAmortizado },
    });
    return NextResponse.json({ data: pag }, { status: 201 });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
