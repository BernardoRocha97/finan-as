import { NextRequest, NextResponse } from "next/server";
import { getXtbTradeHistory, cmdLabel } from "@/lib/xtb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const accountType = (process.env.XTB_ACCOUNT_TYPE ?? "real") as "real" | "demo";

  // Default: last 90 days
  const dias = Number(searchParams.get("dias") ?? 90);
  const end = Date.now();
  const start = end - dias * 24 * 60 * 60 * 1000;

  try {
    const trades = await getXtbTradeHistory(start, end, accountType);

    const fechadas = trades
      .filter((t) => t.closed)
      .map((t) => ({
        orderId: t.order,
        simbolo: t.symbol,
        direcao: cmdLabel(t.cmd),
        volume: t.volume,
        precoEntrada: t.open_price,
        precoSaida: t.close_price,
        lucro: Math.round(t.profit * 100) / 100,
        swap: Math.round(t.storage * 100) / 100,
        comissao: Math.round(t.commission * 100) / 100,
        lucroTotal: Math.round((t.profit + t.storage + t.commission) * 100) / 100,
        dataAbertura: t.open_time,
        dataFecho: t.close_time,
        duracao: t.close_time - t.open_time,
        comment: t.comment,
      }))
      .sort((a, b) => b.dataFecho - a.dataFecho);

    const totalLucro = fechadas.reduce((s, t) => s + t.lucroTotal, 0);
    const vencedoras = fechadas.filter((t) => t.lucroTotal > 0);
    const perdedoras = fechadas.filter((t) => t.lucroTotal < 0);

    return NextResponse.json({
      data: {
        trades: fechadas,
        resumo: {
          total: fechadas.length,
          totalLucro: Math.round(totalLucro * 100) / 100,
          vencedoras: vencedoras.length,
          perdedoras: perdedoras.length,
          taxaSucesso: fechadas.length > 0 ? Math.round((vencedoras.length / fechadas.length) * 10000) / 100 : 0,
          melhorTrade: vencedoras.sort((a, b) => b.lucroTotal - a.lucroTotal)[0] ?? null,
          piorTrade: perdedoras.sort((a, b) => a.lucroTotal - b.lucroTotal)[0] ?? null,
          lucroMedio: fechadas.length > 0 ? Math.round((totalLucro / fechadas.length) * 100) / 100 : 0,
        },
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
