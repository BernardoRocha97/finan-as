export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { generateMonthlyReport } from "@/lib/monthlyReport";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ano = Number(searchParams.get("ano") ?? new Date().getFullYear());
  const mes = Number(searchParams.get("mes") ?? new Date().getMonth() + 1);

  const report = await generateMonthlyReport(ano, mes);
  return NextResponse.json({ data: report });
}

