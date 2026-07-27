export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

function excelDate(serial: number): Date {
  return new Date((serial - 25569) * 86400 * 1000);
}

function parseBuy(comment: string) {
  const m = comment.match(/OPEN BUY\s+([\d.]+)\s*@\s*([\d.]+)/i);
  return m ? { qty: parseFloat(m[1]), price: parseFloat(m[2]) } : null;
}

function parseSell(comment: string) {
  const m = comment.match(/CLOSE BUY\s+([\d.]+)(?:\/[\d.]+)?\s*@\s*([\d.]+)/i);
  return m ? { qty: parseFloat(m[1]), price: parseFloat(m[2]) } : null;
}

const SYM_NAMES: Record<string, string> = {
  "UVV.US": "Universal Corp (UVV)",
  "PEP.US": "PepsiCo (PEP)",
  "BMO.US": "Bank of Montreal (BMO)",
  "MCD.US": "McDonald's (MCD)",
  "JNJ.US": "Johnson & Johnson (JNJ)",
  "ADM.US": "Archer-Daniels-Midland (ADM)",
  "KO.US": "Coca-Cola (KO)",
  "SBUX.US": "Starbucks (SBUX)",
  "JEIP.DE": "JPM Equity Income ETF (JEIP)",
  "QYLD.UK": "Global X NASDAQ 100 Covered Call (QYLD)",
  "JEQP.DE": "JPM Equity Premium Income ETF (JEQP)",
  "BTI.US": "British American Tobacco (BTI)",
  "AGNC.US": "AGNC Investment (AGNC)",
  "STAG.US": "STAG Industrial (STAG)",
  "ENB.US": "Enbridge (ENB)",
  "O.US": "Realty Income (O)",
  "VGWD.DE": "Vanguard FTSE All-World High Div ETF (VGWD)",
  "SPCX.US": "The SPAC and New Issue ETF (SPCX)",
};

function symType(sym: string): string {
  if (sym.endsWith(".DE") || sym.endsWith(".UK")) return "ETF";
  return "ACAO";
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Ficheiro nÃ£o enviado" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const data = rows.slice(11).filter((r) => r.length > 1 && r[1]);

    // Build WHT map
    const whtMap: Record<string, number> = {};
    for (const r of data) {
      if (r[1] === "Withholding Tax" && r[4]) {
        const key = `${r[4]}|${Math.round(r[2] * 1000)}`;
        whtMap[key] = (whtMap[key] ?? 0) + parseFloat(r[5] ?? 0);
      }
    }

    // Ensure Investment records exist
    const symbols = [...new Set(data.filter((r) => r[4]).map((r) => r[4] as string))];
    const invMap: Record<string, string> = {};
    for (const sym of symbols) {
      const existing = await prisma.investment.findFirst({ where: { ticker: sym } });
      if (existing) {
        invMap[sym] = existing.id;
      } else {
        const inv = await prisma.investment.create({
          data: {
            nome: SYM_NAMES[sym] ?? sym,
            ticker: sym,
            tipo: symType(sym),
            quantidade: 0,
            precoMedioCompra: 0,
            valorAtualUnidade: 0,
            plataforma: "XTB",
            ativa: true,
          },
        });
        invMap[sym] = inv.id;
      }
    }

    let compras = 0, vendas = 0, dividendos = 0, duplicados = 0, erros = 0;

    for (const r of data) {
      const [id, tipo, timeSerial, comment, sym, amountRaw] = r;
      if (!tipo || !timeSerial) continue;
      const amount = parseFloat(amountRaw ?? 0);
      const dataTx = excelDate(timeSerial);
      const commentStr = comment ?? "";

      try {
        if (tipo === "Stock purchase" && sym) {
          const parsed = parseBuy(commentStr);
          if (!parsed) continue;
          // Duplicate check by XTB ID in notas
          const dup = await prisma.investmentTransaction.findFirst({
            where: { investmentId: invMap[sym], notas: { contains: String(id) } },
          });
          if (dup) { duplicados++; continue; }
          await prisma.investmentTransaction.create({
            data: {
              investmentId: invMap[sym],
              tipo: "COMPRA",
              data: dataTx,
              quantidade: parsed.qty,
              preco: parsed.price,
              comissao: 0,
              notas: `[XTB:${id}] ${commentStr}`,
            },
          });
          compras++;
        } else if (tipo === "Stock sale" && sym) {
          const parsed = parseSell(commentStr);
          if (!parsed) continue;
          const dup = await prisma.investmentTransaction.findFirst({
            where: { investmentId: invMap[sym], notas: { contains: String(id) } },
          });
          if (dup) { duplicados++; continue; }
          await prisma.investmentTransaction.create({
            data: {
              investmentId: invMap[sym],
              tipo: "VENDA",
              data: dataTx,
              quantidade: parsed.qty,
              preco: parsed.price,
              comissao: 0,
              notas: `[XTB:${id}] ${commentStr}`,
            },
          });
          vendas++;
        } else if (tipo === "DIVIDENT" && sym) {
          const key = `${sym}|${Math.round(timeSerial * 1000)}`;
          const wht = whtMap[key] ?? 0;
          const netDiv = Math.max(0, Math.round((amount + wht) * 100) / 100);
          const dup = await prisma.investmentTransaction.findFirst({
            where: { investmentId: invMap[sym], notas: { contains: String(id) } },
          });
          if (dup) { duplicados++; continue; }
          await prisma.investmentTransaction.create({
            data: {
              investmentId: invMap[sym],
              tipo: "DIVIDENDO",
              data: dataTx,
              valorDividendo: netDiv,
              notas: `[XTB:${id}] ${commentStr}`,
            },
          });
          dividendos++;
        }
      } catch {
        erros++;
      }
    }

    // Recalculate quantities and average prices
    for (const sym of symbols) {
      const invId = invMap[sym];
      const ops = await prisma.investmentTransaction.findMany({
        where: { investmentId: invId, tipo: { in: ["COMPRA", "VENDA"] } },
        orderBy: { data: "asc" },
      });
      let qty = 0, custoMedio = 0;
      for (const op of ops) {
        const q = toNumber(op.quantidade);
        const p = toNumber(op.preco);
        if (op.tipo === "COMPRA") {
          if (qty + q > 0) custoMedio = (custoMedio * qty + p * q) / (qty + q);
          qty += q;
        } else {
          qty = Math.max(0, qty - q);
        }
      }
      await prisma.investment.update({
        where: { id: invId },
        data: {
          quantidade: Math.round(qty * 10000) / 10000,
          precoMedioCompra: Math.round(custoMedio * 10000) / 10000,
        },
      });
    }

    return NextResponse.json({
      data: {
        compras, vendas, dividendos, duplicados, erros,
        simbolos: symbols.length,
        total: compras + vendas + dividendos,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

