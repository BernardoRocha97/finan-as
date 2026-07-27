import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { toNumber } from "@/lib/utils";
import { updateDividendYield } from "@/lib/dividends";

const opSchema = z.object({
  tipo: z.enum(["COMPRA", "VENDA", "DIVIDENDO"]),
  data: z.string(),
  quantidade: z.number().optional().nullable(),
  preco: z.number().optional().nullable(),
  comissao: z.number().default(0),
  valorDividendo: z.number().optional().nullable(),
  accountId: z.string().optional().nullable(),
  notas: z.string().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const inv = await prisma.investment.update({ where: { id }, data: body });
  return NextResponse.json({ data: inv });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.investment.update({ where: { id }, data: { ativa: false } });
  return NextResponse.json({ data: { ok: true } });
}

// POST /api/investimentos/[id] — register operation
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = opSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const inv = await prisma.investment.findUnique({ where: { id } });
  if (!inv) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const op = await prisma.investmentTransaction.create({
    data: { ...parsed.data, investmentId: id, data: new Date(parsed.data.data) },
  });

  // Recalculate weighted average price and quantity
  if (parsed.data.tipo === "COMPRA" || parsed.data.tipo === "VENDA") {
    const ops = await prisma.investmentTransaction.findMany({
      where: { investmentId: id, tipo: { in: ["COMPRA", "VENDA"] } },
      orderBy: { data: "asc" },
    });

    let qty = 0;
    let custo = 0;
    for (const o of ops) {
      if (o.tipo === "COMPRA") {
        const q = toNumber(o.quantidade);
        const p = toNumber(o.preco);
        custo = (custo * qty + p * q) / (qty + q);
        qty += q;
      } else {
        qty -= toNumber(o.quantidade ?? 0);
      }
    }

    await prisma.investment.update({
      where: { id },
      data: { quantidade: qty, precoMedioCompra: custo },
    });
  }

  // Auto-create income transaction for dividend
  if (parsed.data.tipo === "DIVIDENDO" && parsed.data.accountId && parsed.data.valorDividendo) {
    await prisma.transaction.create({
      data: {
        data: new Date(parsed.data.data),
        descricao: `${inv.ticker} — dividendo ${parsed.data.data.slice(0, 10)}`,
        valor: parsed.data.valorDividendo,
        tipo: "RECEITA",
        categoryId: "Dividendos",
        accountId: parsed.data.accountId,
        revisada: true,
        importada: false,
      },
    });
    // Recalc account balance
    const { toNumber: tn } = await import("@/lib/utils");
    const transacoes = await prisma.transaction.findMany({ where: { accountId: parsed.data.accountId, tipo: { not: "TRANSFERENCIA" } } });
    const saldo = transacoes.reduce((s, t) => (t.tipo === "RECEITA" ? s + tn(t.valor) : s - tn(t.valor)), 0);
    await prisma.account.update({ where: { id: parsed.data.accountId }, data: { saldo } });

    await updateDividendYield(id);
  }

  return NextResponse.json({ data: op }, { status: 201 });
}
