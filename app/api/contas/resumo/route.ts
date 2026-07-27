export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";

export async function GET() {
  const contas = await prisma.account.findMany({ where: { ativa: true } });
  const total = contas.reduce((s: number, c) => s + toNumber(c.saldo), 0);
  const porTipo: Record<string, number> = {};
  for (const c of contas) {
    porTipo[c.tipo] = (porTipo[c.tipo] ?? 0) + toNumber(c.saldo);
  }
  return NextResponse.json({ data: { total, porTipo, contas } });
}

