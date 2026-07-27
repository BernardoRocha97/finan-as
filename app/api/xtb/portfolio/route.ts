import { NextResponse } from "next/server";
import { getXtbPortfolio, cmdLabel } from "@/lib/xtb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const accountType = (process.env.XTB_ACCOUNT_TYPE ?? "real") as "real" | "demo";

  try {
    const { balance, trades, symbolData } = await getXtbPortfolio(accountType);

    const posicoes = trades.map((t) => {
      const sym = symbolData[t.symbol];
      const precoAtual = t.cmd === 0 ? sym?.bid : sym?.ask; // BUY usa bid, SELL usa ask
      const valorAtual = precoAtual ? t.volume * (sym?.contractSize ?? 1) * precoAtual : null;
      const valorEntrada = t.volume * (sym?.contractSize ?? 1) * t.open_price;

      return {
        orderId: t.order,
        simbolo: t.symbol,
        descricao: sym?.description ?? t.symbol,
        categoria: sym?.categoryName ?? "",
        direcao: cmdLabel(t.cmd),
        volume: t.volume,
        precoEntrada: t.open_price,
        precoAtual: precoAtual ?? null,
        valorEntrada: Math.round(valorEntrada * 100) / 100,
        valorAtual: valorAtual ? Math.round(valorAtual * 100) / 100 : null,
        lucro: Math.round(t.profit * 100) / 100,
        swap: Math.round(t.storage * 100) / 100,
        comissao: Math.round(t.commission * 100) / 100,
        lucroTotal: Math.round((t.profit + t.storage + t.commission) * 100) / 100,
        dataAbertura: t.open_time,
        sl: t.sl || null,
        tp: t.tp || null,
        moeda: sym?.currency_profit ?? "EUR",
        digits: t.digits,
      };
    });

    const totalInvestido = posicoes.reduce((s, p) => s + p.valorEntrada, 0);
    const totalLucro = posicoes.reduce((s, p) => s + p.lucroTotal, 0);
    const totalValorAtual = posicoes.reduce((s, p) => s + (p.valorAtual ?? p.valorEntrada), 0);

    return NextResponse.json({
      data: {
        saldo: {
          balance: balance.balance,
          equity: balance.equity,
          margem: balance.margin,
          margemLivre: balance.margin_free,
          nivelMargem: balance.margin_level,
          credito: balance.credit,
          moeda: balance.currency,
        },
        posicoes,
        resumo: {
          totalPosicoes: posicoes.length,
          totalInvestido: Math.round(totalInvestido * 100) / 100,
          totalValorAtual: Math.round(totalValorAtual * 100) / 100,
          totalLucro: Math.round(totalLucro * 100) / 100,
          totalLucroPercent: totalInvestido > 0 ? Math.round((totalLucro / totalInvestido) * 10000) / 100 : 0,
          positivasCount: posicoes.filter((p) => p.lucroTotal > 0).length,
          negativasCount: posicoes.filter((p) => p.lucroTotal < 0).length,
        },
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
